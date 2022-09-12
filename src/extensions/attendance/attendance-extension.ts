import { GoogleSpreadsheet } from "google-spreadsheet";
import { Helper } from "../../models/member-states";
import { BaseServerExtension } from "../extension-interface";
import { ExtensionSetupError } from '../../utils/error-types';
import { FgBlue, FgRed, ResetColor } from "../../utils/command-line-colors";
import { AttendingServerV2 } from "../../attending-server/base-attending-server";

import gcsCreds from "../extension-credentials/gcs_service_account_key.json";
import attendanceConfig from '../extension-credentials/attendance-config.json';
import { AttendanceEntry } from "../../attending-server/stats-collector";

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

    constructor(
        private serverName: string,
        private attendanceDoc: GoogleSpreadsheet
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

    override async onHelperStopHelping(
        server: Readonly<AttendingServerV2>,
        helper: Readonly<Required<Helper>>
    ): Promise<void> {
        const entry = server.statsCollector.exportAttendanceStats(helper.member.id);
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
        await this.updateAttendance(entry)
            .catch(() => Promise.reject(error));
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
            "Username",
            "Time In",
            "Time Out",
            "Helped Students",
            "Discord ID",
            "Session Time (ms)",
            "Active Time (ms)",
            "Number of Students Helped",
        ];

        const attendanceSheet =
            this.attendanceDoc.sheetsByTitle[`${this.serverName} Attendance`]
            ?? await this.attendanceDoc.addSheet({
                title: `${this.serverName} Attendance`,
                headerValues: requiredHeaders
            });

        await attendanceSheet.setHeaderRow(requiredHeaders);
        await attendanceSheet.addRow({
            "Username": entry.member.user.username,
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
        }).catch(console.error);
    }
}

export { AttendanceExtension };