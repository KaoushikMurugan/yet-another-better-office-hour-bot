/** @module GoogleSheetLogging */
import { Helpee, Helper } from '../../models/member-states.js';
import { BaseServerExtension, ServerExtension } from '../extension-interface.js';
import { Collection, Guild, GuildMember, Snowflake, VoiceChannel } from 'discord.js';
import { GuildMemberId, SimpleTimeZone } from '../../utils/type-aliases.js';
import { ExpectedSheetErrors } from './google-sheet-constants/expected-sheet-errors.js';
import { FrozenServer } from '../extension-utils.js';
import { padTo2Digits } from '../../utils/util-functions.js';
import { GoogleSheetExtensionState } from './google-sheet-states.js';
import { AttendingServerV2 } from '../../attending-server/base-attending-server.js';
import {
    AttendanceHeaders,
    HelpSessionHeaders,
    attendanceHeaders,
    helpSessionHeaders
} from './google-sheet-constants/column-enums.js';
import { GOOGLE_SHEET_LOGGER } from './shared-sheet-functions.js';

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
    sessionStart: Date; // time join VC, also wait start
    sessionEnd?: Date; // time leave VC
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
    private activeTimeEntries: Collection<GuildMemberId, ActiveTime> = new Collection();
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
    private helpSessionEntries: Collection<GuildMemberId, HelpSessionEntry[]> =
        new Collection();
    /**
     * Students that just got dequeued but haven't joined the VC yet
     * - Key is student member.id, value is corresponding helpee object
     */
    private studentsJustDequeued: Collection<GuildMemberId, Helpee> = new Collection();

    constructor(private readonly guild: Guild) {
        super();
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
     * Start logging the session time as soon as the helper joins VC
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
     * Sends the {@link AttendanceEntry} to google sheets after student leave VC
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
        if (!this.attendanceUpdateIsScheduled) {
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
     * Start logging the {@link HelpSessionEntry} as soon as the student joins VC
     * @param server
     * @param studentMember the student that joined the VC
     * @param voiceChannel which VC the student joined
     */
    override async onStudentJoinVC(
        server: FrozenServer,
        studentMember: GuildMember,
        voiceChannel: VoiceChannel
    ): Promise<void> {
        const helpersInVC = voiceChannel.members.filter(member =>
            server.helpers.has(member.id)
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
            server.helpers.get(helperInVC.id)
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
        _server: FrozenServer,
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
            helpSessionEntries.map(entry => ({
                ...entry,
                sessionEnd: new Date()
            }));
        this.updateHelpSession(completeHelpSessionEntries)
            .then(() => this.helpSessionEntries.delete(studentMember.id))
            .catch((err: Error) =>
                GOOGLE_SHEET_LOGGER.error(err, 'Cannot update help sessions.')
            );
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
        const safeToUpdate =
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            attendanceSheet.headerValues && // this need to be checked, the library has the wrong type
            attendanceSheet.headerValues.length === attendanceHeaders.length &&
            attendanceSheet.headerValues.every(
                // finally check if all headers exist both the previous conditions are true
                header => (attendanceHeaders as string[]).includes(header)
            );
        if (!safeToUpdate) {
            // very slow, O(n^2 * m) string array comparison is faster than this
            await attendanceSheet.setHeaderRow(attendanceHeaders);
        }
        const updatedCountSnapshot = this.attendanceEntries.length;
        // Use callbacks to not block the parent function
        Promise.all([
            attendanceSheet.addRows(
                this.attendanceEntries.map(entry => ({
                    [AttendanceHeaders.HelperUserName]: entry.member.user.username,
                    [AttendanceHeaders.TimeInLocal]: this.timeFormula(
                        entry.helpStart,
                        AttendingServerV2.get(this.guild.id).timezone
                    ),
                    [AttendanceHeaders.TimeOutLocal]: this.timeFormula(
                        entry.helpEnd,
                        AttendingServerV2.get(this.guild.id).timezone
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
                GOOGLE_SHEET_LOGGER.info(
                    this.guild.name,
                    `- Successfully updated ${updatedCountSnapshot} attendance entries.`
                );
                // there might be new elements in the array during the update
                // so we can only delete the ones that have been updated
                // it's safe to splice on arrays with length < updatedCountSnapshot
                this.attendanceEntries.splice(0, updatedCountSnapshot);
                GOOGLE_SHEET_LOGGER.info(
                    this.guild.name,
                    `- ${this.attendanceEntries.length} entries still remain.`
                );
            })
            .catch((err: Error) => {
                GOOGLE_SHEET_LOGGER.error(
                    err,
                    `Error when updating attendance for this batch at ${new Date().toLocaleString()}`
                );
                // have to manually manuever this, otherwise we only get [object Object]
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for (const { member, helpedMembers, ...rest } of this.attendanceEntries) {
                    GOOGLE_SHEET_LOGGER.error(rest);
                    for (const helpedMember of helpedMembers) {
                        GOOGLE_SHEET_LOGGER.error(helpedMember.member.nickname);
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
        const safeToUpdate = // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            helpSessionSheet.headerValues && // this is necessary, could be undefined
            helpSessionSheet.headerValues.length === helpSessionHeaders.length &&
            helpSessionSheet.headerValues.every(header =>
                (helpSessionHeaders as string[]).includes(header)
            );
        if (!safeToUpdate) {
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
                        AttendingServerV2.get(this.guild.id).timezone
                    ),
                    [HelpSessionHeaders.SessionEndLocal]: this.timeFormula(
                        entry.sessionEnd,
                        AttendingServerV2.get(this.guild.id).timezone
                    ),
                    [HelpSessionHeaders.QueueName]: entry.queueName,
                    [HelpSessionHeaders.WaitTimeMs]: entry.waitTimeMs,
                    [HelpSessionHeaders.SessionStartUnix]: entry.sessionStart.getTime(),
                    [HelpSessionHeaders.SessionEndUnix]: entry.sessionStart.getTime()
                })),
                { raw: false, insert: true }
            ),
            helpSessionSheet.loadHeaderRow()
        ]).catch((err: Error) =>
            GOOGLE_SHEET_LOGGER.error(
                { err, entries },
                'Error when updating these help sessions'
            )
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
