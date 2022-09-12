import { GoogleSpreadsheet } from "google-spreadsheet";
import { Helpee, Helper } from "../../models/member-states";
import { BaseServerExtension } from "../extension-interface";
import { ExtensionSetupError } from '../../utils/error-types';
import { FgBlue, FgRed, ResetColor } from "../../utils/command-line-colors";
import { AttendingServerV2 } from "../../attending-server/base-attending-server";

import gcsCreds from "../extension-credentials/gcs_service_account_key.json";
import attendanceConfig from '../extension-credentials/attendance-config.json';
import { Collection, GuildMember, VoiceChannel } from "discord.js";
import { msToHourMins } from "../../utils/util-functions";

type AttendanceEntry = Helper & {
    latestStudentJoinTimeStamp?: Date;
    activeTimeMs: number;
}

/**
 * Helpsession for each student
 * ----
*/
type HelpSessionEntry = {
    'Student Username': string;
    'Student Discord ID': string;
    'Helper Username': string;
    'Helper Discord ID': string;
    'Session Start': Date;  // time join VC
    'Session End'?: Date;  // time leave VC
    'Wait Start': Date; // Helpee.waitStart
    'Queue Name': string;
    'Wait Time (Ms)': number; // wait end - wait start
}
type HelpSessionSheetHeaders = (keyof HelpSessionEntry)[];

class AttendanceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AttendanceError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

class AttendanceExtension extends BaseServerExtension {

    // key is student member.id
    private studentsJustDequeued: Collection<string, Helpee> = new Collection();
    // key is helper member.id
    private attendanceEntries: Collection<string, AttendanceEntry> = new Collection();
    // key is student member.id
    private helpSessionEntries: Collection<string, HelpSessionEntry> = new Collection();

    constructor(
        private serverName: string,
        private googleSheet: GoogleSpreadsheet
    ) { super(); }

    static async load(serverName: string): Promise<AttendanceExtension> {
        if (attendanceConfig.YABOB_GOOGLE_SHEET_ID.length === 0) {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}No Google Sheet ID or Google Cloud credentials found.${ResetColor}\n` +
                ` - Make sure you have the google sheets id in attendance-config.ts ` +
                ` and Google Cloud credentials in gcs_service_account_key.json`
            ));
        }
        const attendanceDoc = new GoogleSpreadsheet(attendanceConfig.YABOB_GOOGLE_SHEET_ID);
        await attendanceDoc.useServiceAccountAuth(gcsCreds);
        await attendanceDoc.loadInfo()
            .catch(() => {
                return Promise.reject(new ExtensionSetupError(
                    `${FgRed}Failed to load google sheet for ${serverName}. ` +
                    `Google sheets rejected our connection.${ResetColor}`
                ));
            });
        console.log(
            `[${FgBlue}Attendance Extension${ResetColor}] ` +
            `successfully loaded for '${serverName}'!\n` +
            ` - Using this google sheet: ${attendanceDoc.title}`
        );
        return new AttendanceExtension(serverName, attendanceDoc);
    }

    override async onDequeueFirst(
        _server: Readonly<AttendingServerV2>,
        dequeuedStudent: Readonly<Helpee>
    ): Promise<void> {
        this.studentsJustDequeued.set(dequeuedStudent.member.id, dequeuedStudent);
    }

    override async onStudentJoinVC(
        server: Readonly<AttendingServerV2>,
        studentMember: GuildMember,
        voiceChannel: VoiceChannel
    ): Promise<void> {
        const helpersInVC = voiceChannel.members
            .filter(member => server.helpers.has(member.id));
        const [studentId, student] = [
            studentMember.id,
            this.studentsJustDequeued.get(studentMember.id)
        ];
        if (helpersInVC.size === 0 || student === undefined) {
            return;
        }
        for (const helper of helpersInVC.map(helperInVC => server.helpers.get(helperInVC.id))) {
            if (helper === undefined) {
                continue;
            }
            const helpSessionEntry: HelpSessionEntry = {
                'Student Username': student.member.user.username,
                'Student Discord ID': studentId,
                'Helper Username': helper.member.user.username,
                'Helper Discord ID': helper.member.id,
                'Session Start': new Date(),
                'Session End': undefined,
                'Wait Start': student.waitStart,
                'Queue Name': student.queue.name,
                'Wait Time (Ms)': (new Date()).getTime() - student.waitStart.getTime(),
            };

            this.helpSessionEntries.set(studentId, helpSessionEntry);
            if (this.attendanceEntries.has(helper.member.id)) {
                // ts doesn't recognize map.has
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.attendanceEntries.get(helper.member.id)!.latestStudentJoinTimeStamp = new Date();
            }
        }
    }

    override async onStudentLeaveVC(
        _server: Readonly<AttendingServerV2>,
        studentMember: GuildMember
    ): Promise<void> {
        const helpSessionEntry = this.helpSessionEntries.get(studentMember.id);
        if (helpSessionEntry === undefined) {
            return;
        }
        helpSessionEntry['Session End'] = new Date();
        this.attendanceEntries.forEach(entry => {
            if (entry.latestStudentJoinTimeStamp !== undefined) {
                entry.activeTimeMs += (new Date()).getTime() -
                    entry.latestStudentJoinTimeStamp.getTime();
            }
        });
        this.helpSessionEntries.delete(studentMember.id);
        // entry is now complete, safe to cast
        await this.updateHelpSession(helpSessionEntry as Required<HelpSessionEntry>);
    }

    override onHelperStartHelping(
        _server: Readonly<AttendingServerV2>,
        helper: Readonly<Omit<Helper, 'helpEnd'>>
    ): Promise<void> {
        const attendanceEntry: AttendanceEntry = {
            ...helper,
            activeTimeMs: 0
        };
        this.attendanceEntries.set(helper.member.id, attendanceEntry);
        return Promise.resolve(); // ts gets really angry if i don't return
    }

    override async onHelperStopHelping(
        _server: Readonly<AttendingServerV2>,
        helper: Readonly<Required<Helper>>
    ): Promise<void> {
        const entry = this.attendanceEntries.get(helper.member.id);
        const error = new AttendanceError(
            `Failed to update attendace. ` +
            `The attendance sheet might have missing headers.\n` +
            `Don't worry, your time is still being logged, ` +
            `just not viewable on Google Sheets. ` +
            `Please contact @Officer to manually update.`
        );
        if (entry === undefined) {
            return Promise.reject(error);
        }
        entry.helpEnd = helper.helpEnd;
        this.studentsJustDequeued
            .filter(student => helper.helpedMembers
                .some(helpedMember => helpedMember.member.id === student.member.id))
            .forEach(studentToDelete => this.studentsJustDequeued
                .delete(studentToDelete.member.id));
        await this.updateAttendance(entry as Required<AttendanceEntry>)
            .catch(() => Promise.reject(error));
        this.attendanceEntries.delete(helper.member.id);
    }

    /**
     * Updates the attendance for 1 helper
     * ----
     * @param entry for 1 helper 
    */
    private async updateAttendance(
        entry: Required<AttendanceEntry>
    ): Promise<void> {
        // try to find existing sheet
        // if not created, make a new one
        const requiredHeaders = [
            "Helper Username",
            "Time In",
            "Time Out",
            "Helped Students",
            "Discord ID",
            "Session Time (ms)",
            "Active Time (ms)",
            "Number of Students Helped",
        ];

        const attendanceSheet =
            this.googleSheet.sheetsByTitle[`${this.serverName} Attendance`]
            ?? await this.googleSheet.addSheet({
                title: `${this.serverName} Attendance`,
                headerValues: requiredHeaders
            });

        await attendanceSheet.setHeaderRow(requiredHeaders);
        await attendanceSheet.addRow({
            "Helper Username": entry.member.user.username,
            "Time In": entry.helpStart.toLocaleString(),
            "Time Out": entry.helpEnd.toLocaleString(),
            "Helped Students": JSON.stringify(entry.helpedMembers
                .map(student => new Object({
                    displayName: student.member.displayName,
                    username: student.member.user.username
                }))),
            "Discord ID": entry.member.id,
            "Session Time (ms)": (entry.helpEnd.getTime()) - (entry.helpStart.getTime()),
            "Active Time (ms)": entry.activeTimeMs,
            "Number of Students Helped": entry.helpedMembers.length,
        });
    }

    private async updateHelpSession(
        entry: Required<HelpSessionEntry>
    ): Promise<void> {
        const requiredHeaders = Object.keys(entry) as HelpSessionSheetHeaders;
        const helpSessionSheet =
            this.googleSheet.sheetsByTitle[`${this.serverName} Help Sessions`]
            ?? await this.googleSheet.addSheet({
                title: `${this.serverName} Help Sessions`,
                headerValues: requiredHeaders
            });
        await helpSessionSheet.setHeaderRow([...requiredHeaders, 'Session Time']);
        await helpSessionSheet.addRow(Object.fromEntries([
            ...requiredHeaders.map(header => entry[header] instanceof Date
                ? [header, entry[header].toLocaleString()]
                : [header, entry[header].toString()]
            ),
            ['Session Time', msToHourMins(entry['Session Start'].getTime() -
                entry['Session End'].getTime())]
        ]));
    }
}

export { AttendanceExtension };