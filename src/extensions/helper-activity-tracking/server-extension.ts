import { Collection, Guild, GuildMember, VoiceBasedChannel } from 'discord.js';
import { Logger } from 'pino';
import { Helpee, Helper } from '../../models/member-states.js';
import { GuildMemberId } from '../../utils/type-aliases.js';
import { BaseServerExtension } from '../extension-interface.js';
import {
    AttendanceEntry,
    ActiveTime,
    PartialHelpSessionEntry,
    HelpSessionEntry
} from './models.js';
import { ATTENDANCE_LOGGER } from './shared-functions.js';
import { FrozenServer } from '../extension-utils.js';
import { TrackingDataStore, firebaseTrackingDb } from './datastore.js';

class HelperActivityTrackingExtension extends BaseServerExtension {
    /**
     * Stores intermediate objects that track active ms of a helper
     * - key is helper member.id
     */
    private activeTimeEntries = new Collection<GuildMemberId, ActiveTime>();
    /**
     * Current active help session entries of each student
     * - key is student member.id, value is an array of entries to handle multiple helpers
     */
    private helpSessionEntries = new Collection<
        GuildMemberId,
        PartialHelpSessionEntry[]
    >();
    /**
     * Students that just got dequeued but haven't joined the VC yet
     * - Key is student member.id, value is corresponding helpee object
     */
    private studentsJustDequeued = new Collection<GuildMemberId, Helpee>();

    private readonly logger: Logger;

    private readonly destinations: TrackingDataStore[] = [firebaseTrackingDb];

    constructor(private readonly guild: Guild) {
        super();
        this.logger = ATTENDANCE_LOGGER.child({ guild: guild.name });
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
     * Writes tracking data relevant to this helper to external data store
     * @param _server
     * @param helper
     */
    override async onHelperStopHelping(
        server: FrozenServer,
        helper: Readonly<Required<Helper>>
    ): Promise<void> {
        const activeTimeEntry = this.activeTimeEntries.get(helper.member.id);
        if (activeTimeEntry === undefined) {
            throw new Error(
                "Failed to update attendance. YABOB doesn't recognize this entry."
            );
        }

        for (const student of helper.helpedMembers) {
            this.studentsJustDequeued.delete(student.member.id);
        }

        this.activeTimeEntries.delete(helper.member.id);
        const attendanceEntry: AttendanceEntry = {
            activeTimeMs: activeTimeEntry.activeTimeMs,
            helper: {
                displayName: helper.member.displayName,
                id: helper.member.id
            },
            helpedMembers: helper.helpedMembers.map(({ member }) => ({
                displayName: member.displayName,
                id: member.id
            })),
            helpStartUnixMs: helper.helpStart.getTime(),
            helpEndUnixMs: helper.helpEnd.getTime()
        };

        if (!server.trackingEnabled) {
            return;
        }

        this.logger.info(`Updating tracking info for ${helper.member.displayName}`);
        const writeResults = await Promise.allSettled(
            this.destinations.map(destination =>
                destination.writeAttendance(this.guild, attendanceEntry)
            )
        );
        for (const [index, result] of writeResults.entries()) {
            if (result.status === 'rejected') {
                this.logger.error(
                    result.reason,
                    `Failed to write tracking data to destination ${
                        this.destinations[index]!.name
                    }`
                );
            }
        }
    }

    /**
     * Start logging the {@link HelpSessionEntry} as soon as the student joins VC
     * @param server
     * @param studentMember the student that joined the VC
     * @param voiceChannel which VC the student joined
     */
    override async onStudentJoinVBC(
        server: FrozenServer,
        studentMember: GuildMember,
        voiceChannel: VoiceBasedChannel
    ): Promise<void> {
        const helpersInVC = voiceChannel.members.filter(member =>
            server.helpers.has(member.id)
        );
        const studentId = studentMember.id;
        const student = this.studentsJustDequeued.get(studentId);

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

            const sessionStartUnixMs = new Date().getTime();
            const helpSessionEntry: PartialHelpSessionEntry = {
                student: {
                    id: student.member.id,
                    displayName: student.member.displayName
                },
                helper: {
                    id: helper.member.id,
                    displayName: helper.member.displayName
                },
                sessionStartUnixMs,
                waitStart: student.waitStart.getTime(),
                queueName: student.queue.queueName,
                waitTimeMs: sessionStartUnixMs - student.waitStart.getTime()
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
     * Sends the help session data to google sheets after student leave VC
     * @param studentMember
     * @noexcept error is logged to the console
     */
    override async onStudentLeaveVBC(
        server: FrozenServer,
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

        const sessionEndUnix = new Date().getTime();
        for (const entry of helpSessionEntries) {
            entry.sessionEndUnixMs = sessionEndUnix;
        }

        if (!server.trackingEnabled) {
            return;
        }

        this.logger.info(`Updating help session info for ${studentMember.displayName}`);
        const writeResults = await Promise.allSettled(
            this.destinations.map(destination =>
                destination.writeHelpSessions(
                    this.guild,
                    helpSessionEntries as HelpSessionEntry[] // checked
                )
            )
        );
        for (const [index, result] of writeResults.entries()) {
            if (result.status === 'rejected') {
                this.logger.error(
                    result.reason,
                    `Failed to write tracking data in destination ${
                        this.destinations[index]!.name
                    }`
                );
            }
        }
        this.helpSessionEntries.delete(studentMember.id);
    }
}

export { HelperActivityTrackingExtension };
