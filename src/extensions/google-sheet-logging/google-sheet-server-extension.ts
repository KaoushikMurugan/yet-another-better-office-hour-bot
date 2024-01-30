/** @module GoogleSheetLogging */
import { Helpee, Helper } from '../../models/member-states.js';
import { BaseServerExtension, ServerExtension } from '../extension-interface.js';
import { Collection, Guild, GuildMember, Snowflake, VoiceBasedChannel } from 'discord.js';
import { GuildMemberId, SimpleTimeZone } from '../../utils/type-aliases.js';
import { ExpectedSheetErrors } from './google-sheet-constants/expected-sheet-errors.js';
import { FrozenServer } from '../extension-utils.js';
import { padTo2Digits } from '../../utils/util-functions.js';
import { GoogleSheetExtensionState } from './google-sheet-states.js';
import { AttendingServer } from '../../attending-server/base-attending-server.js';
import {
    AttendanceHeaders,
    HelpSessionHeaders,
    attendanceHeaders,
    helpSessionHeaders
} from './google-sheet-constants/column-enums.js';
import { GOOGLE_SHEET_LOGGER } from './shared-sheet-functions.js';
import { Logger } from 'pino';
import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { environment } from '../../environment/environment-manager.js';

/**
 * Additional attendance info for each helper
 */
type ActiveTime = {
    latestStudentJoinTimeStamp?: Date;
    activeTimeMs: number;
};

/**
 * 1 Attendance entry of 1 helper
 */
type AttendanceEntry = Omit<Required<ActiveTime & Helper>, 'latestStudentJoinTimeStamp'>;

/**
 * Individual help sessions
 */
type HelpSessionEntry = {
    studentUsername: string;
    studentDiscordId: Snowflake;
    helperUsername: string;
    helperDiscordId: string;
    sessionStart: Date; // time join VBC, also wait start
    sessionEnd?: Date; // time leave VBC
    waitStart: Date; // Helpee.waitStart
    queueName: string;
    waitTimeMs: number; // wait end - wait start
};

// Credit of all the update logic goes to Kaoushik
class GoogleSheetServerExtension extends BaseServerExtension implements ServerExtension {
    /**
     * Used to compose the final attendance entry.
     * - Key is helper member.id, value is entry for this helper
     */
    private activeTimeEntries = new Collection<GuildMemberId, ActiveTime>();
    /**
     * These are the attendance entries that are complete but haven't been sent to google sheets yet
     * - Cleared immediately after google sheet has been successfully updated
     */
    private attendanceEntries: AttendanceEntry[] = [];
    /**
     * Whether an attendance update has been scheduled.
     * - If true, writing to the attendanceEntries will not create another setTimeout
     */
    private attendanceUpdateIsScheduled = false;
    /**
     * Current active help session entries of each student
     * - key is student member.id, value is an array of entries to handle multiple helpers
     */
    private helpSessionEntries = new Collection<GuildMemberId, HelpSessionEntry[]>();
    /**
     * Students that just got dequeued but haven't joined the VBC yet
     * - Key is student member.id, value is corresponding helpee object
     */
    private studentsJustDequeued = new Collection<GuildMemberId, Helpee>();

    private logger: Logger;

    constructor(private readonly guild: Guild) {
        super();
        this.logger = GOOGLE_SHEET_LOGGER.child({ guild: guild.name });
    }

    /**
     * Returns a new GoogleSheetLoggingExtension for 1 guild
     * - Uses the google sheet id from the environment
     * @param guild
     * @throws ExtensionSetupError if
     * - the google sheet id is not set in the environment
     * - the google sheet id is invalid
     * - the google sheet is not accessible
     */
    static async load(guild: Guild): Promise<GoogleSheetServerExtension> {
        const newExtension = new GoogleSheetServerExtension(guild);
        await GoogleSheetExtensionState.load(guild, newExtension);
        return newExtension;
    }

    /**
     * When a student gets dequeued, add them to the studentsJustDequeued collection
     * @param _server
     * @param dequeuedStudent
     */
    override async onDequeueFirst(
        _server: FrozenServer,
        dequeuedStudent: Readonly<Helpee>
    ): Promise<void> {
        this.studentsJustDequeued.set(dequeuedStudent.member.id, dequeuedStudent);
    }

    /**
     * Start logging the session time as soon as the helper joins VBC
     * @param _server unused
     * @param helper
     */
    override async onHelperStartHelping(
        _server: FrozenServer,
        helper: Readonly<Omit<Helper, 'helpEnd'>>
    ): Promise<void> {
        const entry: ActiveTime = {
            latestStudentJoinTimeStamp: undefined,
            activeTimeMs: 0
        };
        this.activeTimeEntries.set(helper.member.id, entry);
    }

    /**
     * Sends the {@link AttendanceEntry} to google sheets after student leave VBC
     * @param _server
     * @param helper
     */
    override async onHelperStopHelping(
        _server: FrozenServer,
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
        if (_server.sheetTracking && !this.attendanceUpdateIsScheduled) {
            // if nothing is scheduled, start a timer
            // otherwise the existing timer will update this entry
            // so no need to schedule another one
            this.attendanceUpdateIsScheduled = true;
            setTimeout(async () => {
                this.attendanceUpdateIsScheduled = false;
                await this.batchUpdateAttendance();
            }, 1000);
        }

        this.activeTimeEntries.delete(helper.member.id);
    }

    /**
     * Delete the state object on server delete
     * - technically not necessary since we don't have timers, but it's good to be explicit
     * @param server the deleted server
     */
    override async onServerDelete(server: FrozenServer): Promise<void> {
        GoogleSheetExtensionState.allStates.delete(server.guild.id);
    }

    /**
     * Start logging the {@link HelpSessionEntry} as soon as the student joins VBC
     * @param server
     * @param studentMember the student that joined the VBC
     * @param voiceBasedChannel which VBC the student joined
     */
    override async onStudentJoinVBC(
        server: FrozenServer,
        studentMember: GuildMember,
        voiceBasedChannel: VoiceBasedChannel
    ): Promise<void> {
        const helpersInVBC = voiceBasedChannel.members.filter(member =>
            server.helpers.has(member.id)
        );
        const [studentId, student] = [
            studentMember.id,
            this.studentsJustDequeued.get(studentMember.id)
        ];

        if (helpersInVBC.size === 0 || student === undefined) {
            return;
        }

        this.studentsJustDequeued.delete(studentId);

        for (const helper of helpersInVBC.map(helperInVBC =>
            server.helpers.get(helperInVBC.id)
        )) {
            if (helper === undefined) {
                continue;
            }

            const helpSessionEntry: HelpSessionEntry = {
                studentUsername: student.member.user.username,
                studentDiscordId: studentId,
                helperUsername: helper.member.user.username,
                helperDiscordId: helper.member.id,
                sessionStart: new Date(),
                sessionEnd: undefined,
                waitStart: student.waitStart,
                queueName: student.queue.queueName,
                waitTimeMs: new Date().getTime() - student.waitStart.getTime()
            };

            if (this.helpSessionEntries.has(studentId)) {
                this.helpSessionEntries.get(studentId)?.push(helpSessionEntry);
            } else {
                this.helpSessionEntries.set(studentId, [helpSessionEntry]);
            }

            if (this.activeTimeEntries.has(helper.member.id)) {
                // ts doesn't recognize map.has
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.activeTimeEntries.get(helper.member.id)!.latestStudentJoinTimeStamp =
                    new Date();
            }
        }
    }

    /**
     * Sends the help session data to google sheets after student leave VBC
     * @param studentMember
     * @noexcept error is logged to the console
     */
    override async onStudentLeaveVBC(
        _server: FrozenServer,
        studentMember: GuildMember
    ): Promise<void> {
        const helpSessionEntries = this.helpSessionEntries.get(studentMember.id);
        if (!helpSessionEntries) {
            return;
        }

        for (const entry of this.activeTimeEntries.values()) {
            if (entry.latestStudentJoinTimeStamp) {
                entry.activeTimeMs +=
                    new Date().getTime() - entry.latestStudentJoinTimeStamp.getTime();
            }
        }

        const completeHelpSessionEntries: Required<HelpSessionEntry>[] =
            helpSessionEntries.map(entry => ({
                ...entry,
                sessionEnd: new Date()
            }));
        this.updateHelpSession(completeHelpSessionEntries)
            .then(() => this.helpSessionEntries.delete(studentMember.id))
            .catch((err: Error) =>
                this.logger.error(err, 'Cannot update help sessions.')
            );
    }

    /**
     * Checks is the spreadsheet is safe to write to.
     * All requiredHeaders need to be present
     *
     * @param sheet worksheet
     * @param requiredHeaders headers
     * @returns bool
     */
    private async hasRequiredHeaders(
        sheet: GoogleSpreadsheetWorksheet,
        requiredHeaders: string[]
    ): Promise<boolean> {
        // the headerValues getter can throw, so we need to use try catch
        try {
            return (
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                sheet.headerValues && // this need to be checked, the library has the wrong type
                sheet.headerValues.length === requiredHeaders.length && // no need to do the comparison if the length don't even match
                sheet.headerValues.every(header => requiredHeaders.includes(header)) // finally check if all headers exist
            );
        } catch {
            return false;
        }
    }

    private async hasWriteAccess(): Promise<boolean> {
        try {
            const permissions = await GoogleSheetExtensionState.get(
                this.guild.id
            ).googleSheet.listPermissions();
            return permissions.some(
                permission =>
                    permission.type === 'user' &&
                    permission.emailAddress ===
                        environment.googleCloudCredentials.client_email &&
                    permission.role === 'writer'
            );
        } catch {
            return false;
        }
    }

    /**
     * Updates all the cached attendance entries
     */
    private async batchUpdateAttendance(): Promise<void> {
        const googleSheet = GoogleSheetExtensionState.safeGet(this.guild.id)?.googleSheet;
        if (this.attendanceEntries.length === 0 || !googleSheet) {
            return;
        }
        // try to find existing sheet
        // if not created, make a new one, also trim off colon because google api bug
        const sheetTitle = `${this.guild.name.replace(/:/g, ' ')} Attendance`.replace(
            /\s{2,}/g,
            ' '
        );
        const attendanceSheet =
            googleSheet.sheetsByTitle[sheetTitle] ??
            (await googleSheet.addSheet({
                title: sheetTitle,
                headerValues: attendanceHeaders
            }));

        const [hasWriteAccess, hasRequiredHeaders] = await Promise.all([
            this.hasWriteAccess(),
            this.hasRequiredHeaders(attendanceSheet, attendanceHeaders)
        ]);

        if (!hasWriteAccess) {
            // TODO: should we throw ExpectedSheetErrors.noWriteAccess?;
            return;
        }
        if (!hasRequiredHeaders) {
            // correctable
            await attendanceSheet.setHeaderRow(attendanceHeaders);
        }

        const updatedCountSnapshot = this.attendanceEntries.length;
        // Use callbacks to not block the parent function
        Promise.all([
            attendanceSheet.addRows(
                this.attendanceEntries.map(entry => ({
                    [AttendanceHeaders.HelperUserName]: entry.member.user.username,
                    [AttendanceHeaders.LocalTimeIn]: this.timeFormula(
                        entry.helpStart,
                        AttendingServer.get(this.guild.id).timezone
                    ),
                    [AttendanceHeaders.LocalTimeOut]: this.timeFormula(
                        entry.helpEnd,
                        AttendingServer.get(this.guild.id).timezone
                    ),
                    [AttendanceHeaders.HelpedStudents]: JSON.stringify(
                        entry.helpedMembers.map(student => ({
                            displayName: student.member.displayName,
                            username: student.member.user.username,
                            id: student.member.id
                        }))
                    ),
                    [AttendanceHeaders.HelperDiscordId]: entry.member.id,
                    [AttendanceHeaders.OfficeHourTimeMs]:
                        entry.helpEnd.getTime() - entry.helpStart.getTime(),
                    [AttendanceHeaders.ActiveTimeMs]: entry.activeTimeMs,
                    [AttendanceHeaders.NumStudents]: entry.helpedMembers.length,
                    [AttendanceHeaders.UnixTimeIn]: entry.helpStart.getTime(),
                    [AttendanceHeaders.UnixTimeOut]: entry.helpEnd.getTime()
                })),
                {
                    raw: false, // false to make google sheets interpret the formula
                    insert: true
                }
            ),
            attendanceSheet.loadHeaderRow()
        ])
            .then(() => {
                this.logger.info(
                    `Successfully updated ${updatedCountSnapshot} attendance entries for ${this.guild.name}.`
                );
                // there might be new elements in the array during the update
                // so we can only delete the ones that have been updated
                // it's safe to splice on arrays with length < updatedCountSnapshot
                //!TODO this logic is incorrect, new entries could have been written during the update
                this.attendanceEntries.splice(0, updatedCountSnapshot);
                this.logger.info(
                    `${this.attendanceEntries.length} entries still remain for ${this.guild.name}.`
                );
            })
            .catch((err: Error) => {
                this.logger.error(err, 'Error when updating attendance');
                // have to manually manuever this, otherwise we only get [object Object]
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for (const { helpedMembers, ...rest } of this.attendanceEntries) {
                    this.logger.error(rest);
                    for (const helpedMember of helpedMembers) {
                        this.logger.error(helpedMember.member.nickname);
                    }
                }
            });
    }

    /**
     * Updates the help session entries for 1 student
     * @param entries the complete help session entries
     */
    private async updateHelpSession(
        entries: Required<HelpSessionEntry>[]
    ): Promise<void> {
        const googleSheet = GoogleSheetExtensionState.safeGet(this.guild.id)?.googleSheet;
        if (entries.length === 0 || !googleSheet) {
            return; // do nothing if there's nothing to update
        }

        // trim off colon because google api bug, then trim off any excess spaces
        const sheetTitle = `${this.guild.name.replace(/:/g, ' ')} Help Sessions`.replace(
            /\s{2,}/g,
            ' '
        );
        const helpSessionSheet =
            googleSheet.sheetsByTitle[sheetTitle] ??
            (await googleSheet.addSheet({
                title: sheetTitle,
                headerValues: helpSessionHeaders
            }));
        const [hasWriteAccess, hasRequiredHeaders] = await Promise.all([
            this.hasWriteAccess(),
            this.hasRequiredHeaders(helpSessionSheet, helpSessionHeaders)
        ]);

        if (!hasWriteAccess) {
            // TODO: fow now if we fail to write, ignore the help session data
            return;
        }
        if (!hasRequiredHeaders) {
            // correctable
            await helpSessionSheet.setHeaderRow(helpSessionHeaders);
        }

        Promise.all([
            helpSessionSheet.addRows(
                entries.map(entry => ({
                    [HelpSessionHeaders.StudentUsername]: entry.studentUsername,
                    [HelpSessionHeaders.StudentDiscordId]: entry.studentDiscordId,
                    [HelpSessionHeaders.HelperUsername]: entry.helperUsername,
                    [HelpSessionHeaders.HelperDiscordId]: entry.helperDiscordId,
                    [HelpSessionHeaders.SessionStartLocal]: this.timeFormula(
                        entry.sessionStart,
                        AttendingServer.get(this.guild.id).timezone
                    ),
                    [HelpSessionHeaders.SessionEndLocal]: this.timeFormula(
                        entry.sessionEnd,
                        AttendingServer.get(this.guild.id).timezone
                    ),
                    [HelpSessionHeaders.QueueName]: entry.queueName,
                    [HelpSessionHeaders.WaitTimeMs]: entry.waitTimeMs,
                    [HelpSessionHeaders.SessionStartUnix]: entry.sessionStart.getTime(),
                    [HelpSessionHeaders.SessionEndUnix]: entry.sessionEnd.getTime()
                })),
                { raw: false, insert: true }
            ),
            helpSessionSheet.loadHeaderRow()
        ]).catch((err: Error) =>
            this.logger.error({ err, entries }, 'Error when updating these help sessions')
        );
    }

    /**
     * Displays a date object on google sheets including the timezone
     * @param date date to show
     * @param timezone timezone of server
     */
    private timeFormula(date: Date, { sign, hours, minutes }: SimpleTimeZone): string {
        return `=TEXT(EPOCHTODATE(${date.getTime()}, 2) ${sign} TIME(${hours}, ${minutes}, 0), "MM/DD/YYYY HH:MM:SS") & " (UTC${sign}${padTo2Digits(
            hours
        )}:${padTo2Digits(minutes)})"`;
    }
}

export { GoogleSheetServerExtension, ActiveTime, AttendanceEntry };
