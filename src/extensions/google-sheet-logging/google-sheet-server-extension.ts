/** @module GoogleSheetLogging */
import { Helpee, Helper } from '../../models/member-states.js';
import { BaseServerExtension, ServerExtension } from '../extension-interface.js';
import { red } from '../../utils/command-line-colors.js';
import { Collection, Guild, GuildMember, VoiceChannel } from 'discord.js';
import { GuildMemberId } from '../../utils/type-aliases.js';
import { ExpectedSheetErrors } from './google-sheet-constants/expected-sheet-errors.js';
import { FrozenServer } from '../extension-utils.js';
import { logWithTimeStamp } from '../../utils/util-functions.js';
import { GoogleSheetExtensionState } from './google-sheet-states.js';

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
    'Student Username': string;
    'Student Discord ID': string;
    'Helper Username': string;
    'Helper Discord ID': string;
    'Session Start': Date; // time join VC, also wait start
    'Session End'?: Date; // time leave VC
    'Wait Start': Date; // Helpee.waitStart
    'Queue Name': string;
    'Wait Time (ms)': number; // wait end - wait start
};

/**
 * Required headers of the help session GoogleSpreadsheetWorkSheet
 */
type HelpSessionSheetHeaders = (keyof HelpSessionEntry)[];

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
            }, 60 * 1000);
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
        const completeHelpSessionEntries = helpSessionEntries.map(entry => ({
            ...entry,
            'Session End': new Date()
        }));
        this.updateHelpSession(completeHelpSessionEntries)
            .then(() => this.helpSessionEntries.delete(studentMember.id))
            .catch((err: Error) =>
                console.error(red('Cannot update help sessions.'), err.name, err.message)
            );
    }

    /** Updates all the cached attendance entries */
    private async batchUpdateAttendance(): Promise<void> {
        const googleSheet = GoogleSheetExtensionState.allStates.get(
            this.guild.id
        )?.googleSheet;
        if (this.attendanceEntries.length === 0 || !googleSheet) {
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
            googleSheet.sheetsByTitle[sheetTitle] ??
            (await googleSheet.addSheet({
                title: sheetTitle,
                headerValues: requiredHeaders
            }));
        const safeToUpdate =
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            attendanceSheet.headerValues && // this need to be checked, the library has the wrong type
            attendanceSheet.headerValues.length === requiredHeaders.length &&
            attendanceSheet.headerValues.every(
                // finally check if all headers exist both the previous conditions are true
                header => requiredHeaders.includes(header)
            );
        if (!safeToUpdate) {
            // very slow, O(n^2 * m) string array comparison is faster than this
            await attendanceSheet.setHeaderRow(requiredHeaders);
        }
        const updatedCountSnapshot = this.attendanceEntries.length;
        // Use callbacks to not block the parent function
        Promise.all([
            attendanceSheet.addRows(
                this.attendanceEntries.map(entry => ({
                    'Helper Username': entry.member.user.username,
                    'Time In': entry.helpStart.toLocaleString('en-US', {
                        timeZone: 'PST8PDT'
                    }),
                    'Time Out': entry.helpEnd.toLocaleString('en-US', {
                        timeZone: 'PST8PDT'
                    }),
                    'Helped Students': JSON.stringify(
                        entry.helpedMembers.map(student => ({
                            displayName: student.member.displayName,
                            username: student.member.user.username,
                            id: student.member.id
                        }))
                    ),
                    'Discord ID': entry.member.id,
                    'Session Time (ms)':
                        entry.helpEnd.getTime() - entry.helpStart.getTime(),
                    'Active Time (ms)': entry.activeTimeMs,
                    'Number of Students Helped': entry.helpedMembers.length
                })),
                {
                    raw: true,
                    insert: true
                }
            ),
            attendanceSheet.loadHeaderRow()
        ])
            .then(() => {
                logWithTimeStamp(
                    this.guild.name,
                    `- Successfully updated ${updatedCountSnapshot} attendance entries.`
                );
                // there might be new elements in the array during the update
                // so we can only delete the ones that have been updated
                // it's safe to splice on arrays with length < updatedCountSnapshot
                this.attendanceEntries.splice(0, updatedCountSnapshot);
                logWithTimeStamp(
                    this.guild.name,
                    `- ${this.attendanceEntries.length} entries still remain.`
                );
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
     * @param entries the complete help session entries
     */
    private async updateHelpSession(
        entries: Required<HelpSessionEntry>[]
    ): Promise<void> {
        const googleSheet = GoogleSheetExtensionState.allStates.get(
            this.guild.id
        )?.googleSheet;
        if (entries[0] === undefined || !googleSheet) {
            return; // do nothing if there's nothing to update
        }
        // trim off colon because google api bug, then trim off any excess spaces
        const sheetTitle = `${this.guild.name.replace(/:/g, ' ')} Help Sessions`.replace(
            /\s{2,}/g,
            ' '
        );
        const requiredHeaders = Object.keys(entries[0]) as HelpSessionSheetHeaders;
        const helpSessionSheet =
            googleSheet.sheetsByTitle[sheetTitle] ??
            (await googleSheet.addSheet({
                title: sheetTitle,
                headerValues: requiredHeaders
            }));
        const safeToUpdate = // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            helpSessionSheet.headerValues && // this is necessary, could be undefined
            helpSessionSheet.headerValues.length ===
                [...requiredHeaders, 'Session Time (ms)'].length &&
            helpSessionSheet.headerValues.every(header =>
                [...requiredHeaders, 'Session Time (ms)'].includes(header)
            );
        if (!safeToUpdate) {
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
                            header === 'Session End' ||
                            header === 'Session Start' ||
                            header === 'Wait Start'
                                ? [
                                      header,
                                      entry[header].toLocaleString('en-US', {
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

export { GoogleSheetServerExtension, ActiveTime, HelpSessionEntry, AttendanceEntry };
