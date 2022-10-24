/** @module GoogleSheetLogging */
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { Helpee, Helper } from '../../models/member-states';
import { BaseServerExtension, IServerExtension } from '../extension-interface';
import { ExtensionSetupError } from '../../utils/error-types';
import { blue, red, yellow } from '../../utils/command-line-colors';
import { AttendingServerV2 } from '../../attending-server/base-attending-server';
import { Collection, GuildMember, VoiceChannel } from 'discord.js';
import { GuildMemberId } from '../../utils/type-aliases';
import environment from '../../environment/environment-manager';
import { ExpectedSheetErrors } from './expected-sheet-errors';

/**
 * Additional attendance info for each helper
 */
type ActiveTime = {
    latestStudentJoinTimeStamp?: Date;
    activeTimeMs: number;
};

type AttendanceEntry = Omit<Required<ActiveTime & Helper>, 'latestStudentJoinTimeStamp'>;

/**
 * Individual help sessions
 */
type HelpSessionEntry = {
    'Student Username': string;
    'Student Discord ID': string;
    'Helper Username': string;
    'Helper Discord ID': string;
    'Session Start': Date; // time join VC
    'Session End'?: Date; // time leave VC
    'Wait Start': Date; // Helpee.waitStart
    'Queue Name': string;
    'Wait Time (ms)': number; // wait end - wait start
};

type HelpSessionSheetHeaders = (keyof HelpSessionEntry)[];

class GoogleSheetLoggingExtension
    extends BaseServerExtension
    implements IServerExtension
{
    // Credit of all the update logic goes to Kaoushik
    /** key is student member.id, value is corresponding helpee object */
    private studentsJustDequeued: Collection<GuildMemberId, Helpee> = new Collection();
    /** key is helper member.id, value is entry for this helper */
    private activeTimeEntries: Collection<GuildMemberId, ActiveTime> = new Collection();
    /** key is student member.id, value is an array of entries to handle multiple helpers */
    private helpSessionEntries: Collection<GuildMemberId, HelpSessionEntry[]> =
        new Collection();

    constructor(private serverName: string, private googleSheet: GoogleSpreadsheet) {
        super();
    }

    static async load(serverName: string): Promise<GoogleSheetLoggingExtension> {
        if (environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID.length === 0) {
            throw new ExtensionSetupError(
                'No Google Sheet ID or Google Cloud credentials found.'
            );
        }
        const googleSheet = new GoogleSpreadsheet(
            environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID
        );
        await googleSheet.useServiceAccountAuth(environment.googleCloudCredentials);
        await googleSheet.loadInfo().catch(() => {
            throw new ExtensionSetupError(
                red(
                    `Failed to load google sheet for ${serverName}. ` +
                        `Google sheets rejected our connection.`
                )
            );
        });
        console.log(
            `[${blue('Google Sheet Logging')}] ` +
                `successfully loaded for '${serverName}'!\n` +
                ` - Using this google sheet: ${yellow(googleSheet.title)}`
        );
        return new GoogleSheetLoggingExtension(serverName, googleSheet);
    }

    override async onDequeueFirst(
        _server: Readonly<AttendingServerV2>,
        dequeuedStudent: Readonly<Helpee>
    ): Promise<void> {
        this.studentsJustDequeued.set(dequeuedStudent.member.id, dequeuedStudent);
    }

    /**
     * Start logging the {@link HelpSessionEntry} as sson as the student joins VC
     * @param server
     * @param studentMember
     * @param voiceChannel
     */
    override async onStudentJoinVC(
        server: Readonly<AttendingServerV2>,
        studentMember: GuildMember,
        voiceChannel: VoiceChannel
    ): Promise<void> {
        const helpersInVC = voiceChannel.members.filter(member =>
            server.activeHelpers.has(member.id)
        );
        const [studentId, student] = [
            studentMember.id,
            this.studentsJustDequeued.get(studentMember.id)
        ];
        if (helpersInVC.size === 0 || student === undefined) {
            return;
        }
        this.studentsJustDequeued.delete(studentId);
        for (const helper of helpersInVC.map(helperInVC =>
            server.activeHelpers.get(helperInVC.id)
        )) {
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
                'Queue Name': student.queue.queueName,
                'Wait Time (ms)': new Date().getTime() - student.waitStart.getTime()
            };
            this.helpSessionEntries.has(studentId)
                ? this.helpSessionEntries.get(studentId)?.push(helpSessionEntry)
                : this.helpSessionEntries.set(studentId, [helpSessionEntry]);
            if (this.activeTimeEntries.has(helper.member.id)) {
                // ts doesn't recognize map.has
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.activeTimeEntries.get(helper.member.id)!.latestStudentJoinTimeStamp =
                    new Date();
            }
        }
    }

    /**
     * Sends the help session data to google sheets after student leave VC
     * @param studentMember
     * @noexcept error is logged to the console
     */
    override async onStudentLeaveVC(
        _server: Readonly<AttendingServerV2>,
        studentMember: GuildMember
    ): Promise<void> {
        const helpSessionEntries = this.helpSessionEntries.get(studentMember.id);
        if (helpSessionEntries === undefined) {
            return;
        }
        this.helpSessionEntries.delete(studentMember.id);
        this.activeTimeEntries.forEach(entry => {
            if (entry.latestStudentJoinTimeStamp !== undefined) {
                entry.activeTimeMs +=
                    new Date().getTime() - entry.latestStudentJoinTimeStamp.getTime();
            }
        });
        const completeHelpSessionEntries: Required<HelpSessionEntry>[] =
            helpSessionEntries.map(entry => {
                return { ...entry, 'Session End': new Date() };
            });
        await this.updateHelpSession(completeHelpSessionEntries).catch((err: Error) =>
            console.error(red('Cannot update help sessions'), err.name, err.message)
        );
    }

    override async onHelperStartHelping(
        _server: Readonly<AttendingServerV2>,
        helper: Readonly<Omit<Helper, 'helpEnd'>>
    ): Promise<void> {
        const entry: ActiveTime = {
            latestStudentJoinTimeStamp: undefined,
            activeTimeMs: 0
        };
        this.activeTimeEntries.set(helper.member.id, entry);
    }

    /**
     * Sends the {@link AttendanceEntry} to google sheets after student leave VC
     * @param _server
     * @param helper
     */
    override async onHelperStopHelping(
        _server: Readonly<AttendingServerV2>,
        helper: Readonly<Required<Helper>>
    ): Promise<void> {
        const entry = this.activeTimeEntries.get(helper.member.id);
        if (entry === undefined) {
            throw ExpectedSheetErrors.unknownEntry;
        }
        this.activeTimeEntries.delete(helper.member.id);
        helper.helpedMembers.map(student =>
            this.studentsJustDequeued.delete(student.member.id)
        );
        await this.updateAttendance({ ...entry, ...helper }).catch(() => {
            throw ExpectedSheetErrors.recordedButCannotUpdate;
        });
        this.activeTimeEntries.delete(helper.member.id);
    }

    /**
     * Updates the attendance for 1 helper
     * @param entry
     */
    private async updateAttendance(entry: AttendanceEntry): Promise<void> {
        const requiredHeaders = [
            'Helper Username',
            'Time In',
            'Time Out',
            'Helped Students',
            'Discord ID',
            'Session Time (ms)',
            'Active Time (ms)',
            'Number of Students Helped'
        ];
        // try to find existing sheet
        // if not created, make a new one, also trim off colon because google api bug
        const sheetTitle = `${this.serverName.replace(/:/g, ' ')} Attendance`.replace(
            /\s{2,}/g,
            ' '
        );
        const attendanceSheet =
            this.googleSheet.sheetsByTitle[sheetTitle] ??
            (await this.googleSheet.addSheet({
                title: sheetTitle,
                headerValues: requiredHeaders
            }));
        if (
            attendanceSheet.headerValues === undefined ||
            attendanceSheet.headerValues.length !== requiredHeaders.length ||
            !attendanceSheet.headerValues.every(header =>
                requiredHeaders.includes(header)
            )
        ) {
            // very slow, O(n^2 * m) string array comparison is faster than this
            await attendanceSheet.setHeaderRow(requiredHeaders);
        }
        // Fire the promise then forget, if an exception comes back just log it to the console
        void Promise.all([
            attendanceSheet.addRow(
                {
                    'Helper Username': entry.member.user.username,
                    'Time In': entry.helpStart.toLocaleString('en-US', {
                        timeZone: 'PST8PDT'
                    }),
                    'Time Out': entry.helpEnd.toLocaleString('en-US', {
                        timeZone: 'PST8PDT'
                    }),
                    'Helped Students': JSON.stringify(
                        entry.helpedMembers.map(
                            student =>
                                new Object({
                                    displayName: student.member.displayName,
                                    username: student.member.user.username,
                                    id: student.member.id
                                })
                        )
                    ),
                    'Discord ID': entry.member.id,
                    'Session Time (ms)':
                        entry.helpEnd.getTime() - entry.helpStart.getTime(),
                    'Active Time (ms)': entry.activeTimeMs,
                    'Number of Students Helped': entry.helpedMembers.length
                },
                {
                    raw: true,
                    insert: true
                }
            ),
            attendanceSheet.loadHeaderRow()
        ]).catch((err: Error) => {
            /**
             * Catch clause must be here
             * catching in {@link onHelperStopHelping} cannot catch the error of this call
             * because it's not awaited
             */
            console.error(
                red(`Error when updating attendance for ${entry.member.user.username}: `),
                err.name,
                err.message
            );
        });
    }

    /**
     * Updates the help session entries for 1 student
     * @param entries
     */
    private async updateHelpSession(
        entries: Required<HelpSessionEntry>[]
    ): Promise<void> {
        if (entries[0] === undefined) {
            return;
        }
        // trim off colon because google api bug, then trim off any excess spaces
        const sheetTitle = `${this.serverName.replace(/:/g, ' ')} Help Sessions`.replace(
            /\s{2,}/g,
            ' '
        );
        const requiredHeaders = Object.keys(entries[0]) as HelpSessionSheetHeaders;
        const helpSessionSheet =
            this.googleSheet.sheetsByTitle[sheetTitle] ??
            (await this.googleSheet.addSheet({
                title: sheetTitle,
                headerValues: requiredHeaders
            }));
        if (
            helpSessionSheet.headerValues === undefined ||
            helpSessionSheet.headerValues.length !==
                [...requiredHeaders, 'Session Time (ms)'].length ||
            !helpSessionSheet.headerValues.every(header =>
                [...requiredHeaders, 'Session Time (ms)'].includes(header)
            )
        ) {
            await helpSessionSheet.setHeaderRow([
                ...requiredHeaders,
                'Session Time (ms)'
            ]);
        }
        void Promise.all([
            helpSessionSheet.addRows(
                entries.map(entry =>
                    Object.fromEntries([
                        ...requiredHeaders.map(header =>
                            entry[header] instanceof Date
                                ? [
                                      header,
                                      (entry[header] as Date).toLocaleString('en-US', {
                                          timeZone: 'PST8PDT'
                                      })
                                  ]
                                : [header, entry[header].toString()]
                        ),
                        [
                            'Session Time (ms)',
                            entry['Session End'].getTime() -
                                entry['Session Start'].getTime()
                        ]
                    ])
                ),
                { raw: true, insert: true }
            ),
            helpSessionSheet.loadHeaderRow()
        ]).catch((err: Error) =>
            console.error(
                red('Error when updating help session: '),
                err.name,
                err.message
            )
        );
    }
}

export { GoogleSheetLoggingExtension, ActiveTime, HelpSessionEntry, AttendanceEntry };
