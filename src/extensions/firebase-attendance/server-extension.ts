import { Collection, Guild, GuildMember, VoiceChannel } from 'discord.js';
import { Logger } from 'pino';
import { Helpee, Helper } from '../../models/member-states.js';
import { GuildMemberId } from '../../utils/type-aliases.js';
import { BaseServerExtension } from '../extension-interface.js';
import {
    AttendanceEntry,
    HelpSessionEntry,
    ActiveTime,
    PartialHelpSessionEntry,
    attendanceDocumentSchema
} from './models.js';
import { ATTENDANCE_LOGGER } from './shared-functions.js';
import { FrozenServer } from '../extension-utils.js';
import { type Firestore } from 'firebase-admin/firestore';

class FirebaseAttendanceLogging extends BaseServerExtension {
    private activeTimeEntries = new Collection<GuildMemberId, ActiveTime>();
    /**
     * These are the attendance entries that are complete but haven't been sent to google sheets yet
     * - Cleared immediately after google sheet has been successfully updated
     */
    private attendanceEntries: AttendanceEntry[] = [];
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

    private logger: Logger;

    constructor(
        private readonly guild: Guild,
        private readonly db: Firestore
    ) {
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
     * Sends the {@link AttendanceEntry} to google sheets after student leave VC
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

        this.attendanceEntries.push({
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
            helpEndUnixMs: helper.helpStart.getTime()
        });

        if (server.sheetTracking) {
            console.log('update', this.attendanceEntries);
            await this.postAttendanceEntriesToDb().catch(() => {
                this.logger.error('Db update failed');
                this.logger.error(this.attendanceEntries);
            });
            this.attendanceEntries = [];
        }

        this.activeTimeEntries.delete(helper.member.id);
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

            const helpSessionEntry: PartialHelpSessionEntry = {
                studentUsername: student.member.user.username,
                studentDiscordId: studentId,
                helperUsername: helper.member.user.username,
                helperDiscordId: helper.member.id,
                sessionStartUnixMs: new Date().getTime(),
                waitStart: student.waitStart.getTime(),
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
     * Sends the help session data to google sheets after student leave VC
     * @param studentMember
     * @noexcept error is logged to the console
     */
    override async onStudentLeaveVC(
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

        const completeHelpSessionEntries: HelpSessionEntry[] = helpSessionEntries.map(
            entry => ({
                ...entry,
                sessionEndUnixMs: new Date().getTime()
            })
        );
        console.log(completeHelpSessionEntries);
    }

    private async postAttendanceEntriesToDb(): Promise<void> {
        const doc = await this.db.collection('attendance').doc(this.guild.id).get();
        if (!doc.exists) {
            this.logger.info(
                `Creating new attendance doc for ${this.guild.name}, id=${this.guild.id}`
            );
            await this.db
                .collection('attendance')
                .doc(this.guild.id)
                .set({ entries: [...this.attendanceEntries.values()] });
            return;
        }

        const unpack = attendanceDocumentSchema.safeParse(doc.data());
        if (!unpack.success) {
            this.logger.error('Attendance data is corrupted');
            return;
        }

        this.db
            .collection('attendance')
            .doc(this.guild.id)
            .update({
                entries: [...unpack.data.entries, ...this.attendanceEntries]
            })
            .catch(err =>
                this.logger.error(err, 'Failed to write attendance data to firebase db')
            );
    }
}

export { FirebaseAttendanceLogging };
