/** @module GoogleSheetLogging */
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { Helpee, Helper } from '../../models/member-states.js';
import { BaseServerExtension, IServerExtension } from '../extension-interface.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { blue, cyan, red, yellow } from '../../utils/command-line-colors.js';
import { AttendingServerV2 } from '../../attending-server/base-attending-server.js';
import { Collection, Guild, GuildMember, VoiceChannel } from 'discord.js';
import { GuildMemberId } from '../../utils/type-aliases.js';
import { environment } from '../../environment/environment-manager.js';
import { ExpectedSheetErrors } from './expected-sheet-errors.js';

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

// Credit of all the update logic goes to Kaoushik
class GoogleSheetLoggingExtension
    extends BaseServerExtension
    implements IServerExtension
{
    /** key is student member.id, value is corresponding helpee object */
    private studentsJustDequeued: Collection<GuildMemberId, Helpee> = new Collection();
    /**
     * Used to compose the final attendance entry.
     * - Key is helper member.id, value is entry for this helper
     */
    private activeTimeEntries: Collection<GuildMemberId, ActiveTime> = new Collection();
    /**
     * key is student member.id, value is an array of entries to handle multiple helpers
     */
    private helpSessionEntries: Collection<GuildMemberId, HelpSessionEntry[]> =
        new Collection();
    /**
     * These are the attendance entries that are complete but haven't been sent to google sheets yet
     * - Cleared immediately after google sheet has been successfully updated
     */
    private attendanceEntries: AttendanceEntry[] = [];
    /**
     * Whether an attendence update has been scheduled.
     * - If true, writeing to the attendanceEntries will not create another setTimeout
     */
    private attendanceUpdateIsScheduled = false;

    constructor(private guild: Guild, private googleSheet: GoogleSpreadsheet) {
        super();
    }

    /**
     * Returns a new GoogleSheetLoggingExtension for the server with the given name
     * - Uses the google sheet id from the environment
     * @param serverName
     * @throws ExtensionSetupError if
     * - the google sheet id is not set in the environment
     * - the google sheet id is invalid
     * - the google sheet is not accessible
     */
    static async load(guild: Guild): Promise<GoogleSheetLoggingExtension> {
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
                    `Failed to load google sheet for ${guild.name}. ` +
                        `Google sheets rejected our connection.`
                )
            );
        });
        console.log(
            `[${blue('Google Sheet Logging')}] ` +
                `successfully loaded for '${guild.name}'!\n` +
                ` - Using this google sheet: ${yellow(googleSheet.title)}`
        );
        return new GoogleSheetLoggingExtension(guild, googleSheet);
    }

    /**
     * When a student gets dequeued, add them to the studentsJustDequeued collection
     * @param _server
     * @param dequeuedStudent
     */
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
        for (const entry of this.activeTimeEntries.values()) {
            if (entry.latestStudentJoinTimeStamp !== undefined) {
                entry.activeTimeMs +=
                    new Date().getTime() - entry.latestStudentJoinTimeStamp.getTime();
            }
        }
        const completeHelpSessionEntries: Required<HelpSessionEntry>[] =
            helpSessionEntries.map(entry => {
                return { ...entry, 'Session End': new Date() };
            });
        this.updateHelpSession(completeHelpSessionEntries)
            .then(() => this.helpSessionEntries.delete(studentMember.id))
            .catch((err: Error) =>
                console.error(red('Cannot update help sessions'), err.name, err.message)
            );
    }

    /**
     * Start logging the session time as soon as the helper joins VC
     * @param _server
     * @param helper
     */
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
        const activeTimeEntry = this.activeTimeEntries.get(helper.member.id);
        if (activeTimeEntry === undefined) {
            throw ExpectedSheetErrors.unknownEntry;
        }
        for (const student of helper.helpedMembers) {
            this.studentsJustDequeued.delete(student.member.id);
        }
        this.attendanceEntries.push({ ...activeTimeEntry, ...helper });
        if (!this.attendanceUpdateIsScheduled) {
            // if nothing is scheduled, start a timer
            // otherwise the existing timer will update this entry
            // so no need to schedule another one
            this.attendanceUpdateIsScheduled = true;
            setTimeout(async () => {
                this.attendanceUpdateIsScheduled = false;
                await this.batchUpdateAttendance();
            }, 60 * 1000);
        }
        this.activeTimeEntries.delete(helper.member.id);
    }

    /**
     * Updates the attendance for 1 helper
     * @param entry
     */
    private async batchUpdateAttendance(): Promise<void> {
        if (this.attendanceEntries.length === 0) {
            return;
        }
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
        const sheetTitle = `${this.guild.name.replace(/:/g, ' ')} Attendance`.replace(
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
            !attendanceSheet.headerValues ||
            attendanceSheet.headerValues.length !== requiredHeaders.length ||
            !attendanceSheet.headerValues.every(header =>
                requiredHeaders.includes(header)
            )
        ) {
            // very slow, O(n^2 * m) string array comparison is faster than this
            await attendanceSheet.setHeaderRow(requiredHeaders);
        }
        const updatedCountSnapshot = this.attendanceEntries.length;
        // Use callbacks to not block the parent function
        Promise.all([
            attendanceSheet.addRows(
                this.attendanceEntries.map(entry => {
                    return {
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
                    };
                }),
                {
                    raw: true,
                    insert: true
                }
            ),
            attendanceSheet.loadHeaderRow()
        ])
            .then(() => {
                console.log(
                    `[${cyan(new Date().toLocaleString())} ${yellow(
                        this.guild.name
                    )}]\n - Successfully updated ${
                        this.attendanceEntries.length
                    } attendance entries.`
                );
                // there might be new elements in the array during the update
                // so we can only delete the ones that have been updated
                // it's safe to splice on arrays with length < updatedCountSnapshot
                this.attendanceEntries.splice(0, updatedCountSnapshot);
            })
            .catch((err: Error) => {
                console.error(
                    red(
                        `Error when updating attendance for this batch at ${new Date().toLocaleString()}`
                    ),
                    this.attendanceEntries,
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
        const sheetTitle = `${this.guild.name.replace(/:/g, ' ')} Help Sessions`.replace(
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
        Promise.all([
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
