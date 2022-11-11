/** @module HelpQueueV2 */

import { GuildMember, Role, TextChannel, User, Collection } from 'discord.js';
import { QueueChannel } from '../attending-server/base-attending-server.js';
import { CalendarQueueExtension } from '../extensions/session-calendar/calendar-queue-extension.js';
import { IQueueExtension } from '../extensions/extension-interface.js';
import { QueueBackup } from '../models/backups.js';
import { Helpee } from '../models/member-states.js';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper.js';
import { PeriodicUpdateError } from '../utils/error-types.js';
import { QueueDisplayV2 } from './queue-display.js';
import { GuildMemberId, Optional } from '../utils/type-aliases.js';
import { environment } from '../environment/environment-manager.js';
import { ExpectedQueueErrors } from './expected-queue-errors.js';
import { addTimeOffset } from '../utils/util-functions.js';

type QueueViewModel = {
    queueName: string;
    helperIDs: string[];
    studentDisplayNames: string[];
    isOpen: boolean;
    seriousModeEnabled: boolean;
    timeUntilAutoClear: 'AUTO_CLEAR_DISABLED' | Date;
};

/** @internal */
type QueueTimerType = 'QUEUE_PERIODIC_UPDATE' | 'QUEUE_AUTO_CLEAR';

/**
 * Represents the time until the queue is automatically cleared
 */
type AutoClearTimeout = { hours: number; minutes: number } | 'AUTO_CLEAR_DISABLED';

/**
 * Class that manages the queue for a specific category
 */
class HelpQueueV2 {
    /** Keeps track of all the setTimout / setIntervals we started */
    timers: Collection<QueueTimerType, NodeJS.Timer | NodeJS.Timeout> = new Collection();
    /** Why so serious? */
    private _seriousModeEnabled = false;
    /** Set of active helpers' ids */
    private _activeHelperIds: Set<string> = new Set();
    /** The actual queue of students */
    private _students: Helpee[] = [];
    /** The set of students to notify when queue opens, key is Guildmember.id */
    private notifGroup: Collection<GuildMemberId, GuildMember> = new Collection();
    /** When to automatically remove everyone */
    private _timeUntilAutoClear: AutoClearTimeout = 'AUTO_CLEAR_DISABLED';

    /**
     * @param user YABOB's user object for QueueDisplay
     * @param queueChannel the channel to manage
     * @param queueExtensions individual queue extensions to inject
     * @param backupData If defined, use this data to restore the students array
     */
    protected constructor(
        private queueChannel: QueueChannel,
        private queueExtensions: IQueueExtension[],
        private readonly display: QueueDisplayV2,
        user: User,
        backupData?: QueueBackup & {
            timeUntilAutoClear: AutoClearTimeout;
            seriousModeEnabled: boolean;
        }
    ) {
        this.display = new QueueDisplayV2(user, queueChannel);
        if (backupData === undefined) {
            // if no backup then we are done initializing
            return;
        }
        this._timeUntilAutoClear = backupData.timeUntilAutoClear;
        this._seriousModeEnabled = backupData.seriousModeEnabled;
        for (const studentBackup of backupData.studentsInQueue) {
            // forEach backup, if there's a corresponding channel member, push it into queue
            const correspondingMember = this.queueChannel.channelObj.members.get(
                studentBackup.memberId
            );
            if (correspondingMember !== undefined) {
                this._students.push({
                    waitStart: studentBackup.waitStart,
                    member: correspondingMember,
                    queue: this
                });
            }
        }
    }

    /** number of students */
    get length(): number {
        return this._students.length;
    }
    /** is the queue open */
    get isOpen(): boolean {
        return this.activeHelperIds.size > 0;
    }
    /** name of corresponding queue */
    get queueName(): string {
        return this.queueChannel.queueName;
    }
    /** #queue text channel object */
    get channelObj(): Readonly<TextChannel> {
        return this.queueChannel.channelObj;
    }
    /** ChannelId of the parent category */
    get parentCategoryId(): string {
        return this.queueChannel.parentCategoryId;
    }
    /** First student; undefined if no one is here */
    get first(): Optional<Helpee> {
        return this._students[0];
    }
    /** All students */
    get students(): ReadonlyArray<Helpee> {
        return this._students;
    }
    /** set of helper IDs. Enforce readonly */
    get activeHelperIds(): ReadonlySet<string> {
        return this._activeHelperIds;
    }
    /** Time until auto clear happens */
    get timeUntilAutoClear(): AutoClearTimeout {
        return this._timeUntilAutoClear;
    }
    /** The seriousness of the queue */
    get seriousModeEnabled(): boolean {
        return this._seriousModeEnabled;
    }

    /**
     * Used for queue delete and server delete. Remove all timers spawned by this queue.
     */
    clearAllQueueTimers(): void {
        clearInterval(this.display.renderLoopTimerId);
        this.timers.forEach(clearInterval);
        this.timers.clear();
    }

    /**
     * Asynchronously creates a clean queue
     * @param queueChannel the corresponding text channel and its name
     * @param user YABOB's client object. Used for queue rendering
     * @param everyoneRole used for locking the queue
     * @param backupData backup queue data directly passed to the constructor
     */
    static async create(
        queueChannel: QueueChannel,
        user: User,
        everyoneRole: Role,
        backupData?: QueueBackup & {
            timeUntilAutoClear: AutoClearTimeout;
            seriousModeEnabled: boolean;
        }
    ): Promise<HelpQueueV2> {
        const queueExtensions = environment.disableExtensions
            ? []
            : await Promise.all([
                  CalendarQueueExtension.load(
                      1, // renderIndex
                      queueChannel
                  )
              ]);
        const display = new QueueDisplayV2(user, queueChannel);
        const queue = new HelpQueueV2(
            queueChannel,
            queueExtensions,
            display,
            user,
            backupData
        );
        // They need to happen first
        // because extensions need to rerender in cleanUpQueueChannel()
        await Promise.all(
            queueExtensions.map(extension => extension.onQueueCreate(queue))
        );
        await Promise.all(
            queueExtensions.map(extension => extension.onQueuePeriodicUpdate(queue, true))
        );
        await Promise.all([
            queueChannel.channelObj.permissionOverwrites.create(everyoneRole, {
                SendMessages: false,
                CreatePrivateThreads: false,
                CreatePublicThreads: false,
                AddReactions: false
            }),
            queue.triggerRender()
        ]);
        queue.timers.set(
            'QUEUE_PERIODIC_UPDATE',
            setInterval(
                async () =>
                    await Promise.all(
                        queueExtensions.map(extension =>
                            extension.onQueuePeriodicUpdate(queue, false)
                        )
                    ).catch((err: Error) =>
                        console.error(
                            new PeriodicUpdateError(
                                `${err.name}: ${err.message}`,
                                'Queue'
                            )
                        )
                    ), // Random 0~2min offset to avoid spamming the APIs
                1000 * 60 * 60 + Math.floor(Math.random() * 1000 * 60 * 2)
            )
        );
        if (queue.timeUntilAutoClear !== 'AUTO_CLEAR_DISABLED') {
            await queue.startAutoClearTimer();
        }
        return queue;
    }

    /**
     * Open a queue with a helper
     * @param helperMember member with Staff/Admin that used /start
     * @param notify whether to notify everyone in the notif group
     * @throws QueueError: do nothing if helperMemeber is already helping
     */
    async openQueue(helperMember: GuildMember, notify: boolean): Promise<void> {
        if (this._activeHelperIds.has(helperMember.id)) {
            throw ExpectedQueueErrors.alreadyOpen(this.queueName);
        }
        this._activeHelperIds.add(helperMember.id);
        await Promise.all([
            ...this.notifGroup.map(
                notifMember =>
                    notify && // shorthand syntax, the RHS of && will be invoked if LHS is true
                    !this.activeHelperIds.has(notifMember.id) && // don't notify helpers
                    notifMember.send(SimpleEmbed(`Queue \`${this.queueName}\` is open!`))
            ),
            ...this.queueExtensions.map(extension => extension.onQueueOpen(this)),
            this.triggerRender()
        ]);
        if (notify) {
            // clear AFTER the message is successfully sent to avoid race conditions
            this.notifGroup.clear();
        }
    }

    /**
     * Close a queue with a helper
     * @param helperMember member with Staff/Admin that used /stop
     * @throws QueueError: do nothing if queue is closed
     */
    async closeQueue(helperMember: GuildMember): Promise<void> {
        // These will be caught and show 'You are not currently helping'
        if (!this.isOpen) {
            throw ExpectedQueueErrors.alreadyClosed(this.queueName);
        }
        if (!this._activeHelperIds.has(helperMember.id)) {
            throw ExpectedQueueErrors.notActiveHelper(this.queueName);
        }
        this._activeHelperIds.delete(helperMember.id);
        if (!this.isOpen) {
            await this.startAutoClearTimer();
        }
        await Promise.all([
            ...this.queueExtensions.map(extension => extension.onQueueClose(this)),
            this.triggerRender()
        ]);
    }

    /**
     * Enqueue a student
     * @param studentMember the complete Helpee object
     * @throws QueueError
     */
    async enqueue(studentMember: GuildMember): Promise<void> {
        if (!this.isOpen) {
            throw ExpectedQueueErrors.notOpen(this.queueName);
        }
        if (this._students.find(s => s.member.id === studentMember.id) !== undefined) {
            throw ExpectedQueueErrors.alreadyInQueue(this.queueName);
        }
        if (this._activeHelperIds.has(studentMember.id)) {
            throw ExpectedQueueErrors.enqueueHelper(this.queueName);
        }
        const student: Helpee = {
            waitStart: new Date(),
            member: studentMember,
            queue: this
        };
        this._students.push(student);
        // converted to use Array.map
        const helperIdArray = [...this._activeHelperIds];
        // unknown explicitly states that we don't need the return types
        // this is different from any. Any is skipping type checking
        await Promise.all<unknown>([
            ...helperIdArray.map(helperId =>
                this.queueChannel.channelObj.members
                    .get(helperId)
                    ?.send(
                        SimpleEmbed(
                            `Heads up! ${student.member.displayName} has joined '${this.queueName}'.`,
                            EmbedColor.Neutral,
                            `<@${student.member.user.id}>`
                        )
                    )
            ),
            ...this.queueExtensions.map(extension => extension.onEnqueue(this, student)),
            this.triggerRender()
        ]);
    }

    /**
     * Dequeue this particular queue with a helper
     * @param helperMember the member that triggered dequeue
     * @param targetStudentMember the student to look for if specified
     * @throws QueueError when
     * - Queue is not open
     * - No student is here
     * - helperMember is not one of the helpers
     * - targetStudentMember specified but not in queue
     */
    async dequeueWithHelper(
        helperMember: GuildMember,
        targetStudentMember?: GuildMember
    ): Promise<Readonly<Helpee>> {
        if (!this.isOpen) {
            throw ExpectedQueueErrors.dequeue.closed(this.queueName);
        }
        if (!this._activeHelperIds.has(helperMember.id)) {
            throw ExpectedQueueErrors.dequeue.noPermission(this.queueName);
        }
        if (this._students.length === 0) {
            throw ExpectedQueueErrors.dequeue.empty(this.queueName);
        }
        if (targetStudentMember !== undefined) {
            const studentIndex = this._students.findIndex(
                student => student.member.id === targetStudentMember.id
            );
            if (studentIndex === -1) {
                throw ExpectedQueueErrors.studentNotInQueue(
                    targetStudentMember.displayName,
                    this.queueName
                );
            }
            // already checked for idx === -1
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const foundStudent = this._students[studentIndex]!;
            this._students.splice(studentIndex, 1);
            await Promise.all([
                ...this.queueExtensions.map(extension =>
                    extension.onDequeue(this, foundStudent)
                ),
                this.triggerRender()
            ]);
            return foundStudent;
        }
        // assertion is safe becasue we already checked for length
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const firstStudent = this._students.shift()!;
        await Promise.all([
            ...this.queueExtensions.map(extension =>
                extension.onDequeue(this, firstStudent)
            ),
            this.triggerRender()
        ]);
        return firstStudent;
    }

    /**
     * Remove a student from the queue. Used for /leave
     * @param targetStudentMember the student to remove
     * @throws QueueError: the student is not in the queue
     */
    async removeStudent(targetStudentMember: GuildMember): Promise<Helpee> {
        const idx = this._students.findIndex(
            student => student.member.id === targetStudentMember.id
        );
        if (idx === -1) {
            throw ExpectedQueueErrors.studentNotInQueue(
                targetStudentMember.displayName,
                this.queueName
            );
        }
        // we checked for idx === -1, so it will not be null
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const removedStudent = this._students[idx]!;
        this._students.splice(idx, 1);
        await Promise.all([
            ...this.queueExtensions.map(extension =>
                extension.onStudentRemove(this, removedStudent)
            ),
            this.triggerRender()
        ]);
        return removedStudent;
    }

    /**
     * Remove all students from the queue. Used for /clear_all
     */
    async removeAllStudents(): Promise<void> {
        await Promise.all(
            this.queueExtensions.map(extension =>
                extension.onRemoveAllStudents(this, this._students)
            )
        );
        if (this._students.length !== 0) {
            // avoid unnecessary render
            this._students = [];
            await this.triggerRender();
        }
    }

    /**
     * Adds a student to the notification group.
     * Used for JoinNotif button
     */
    async addToNotifGroup(targetStudent: GuildMember): Promise<void> {
        if (this.notifGroup.has(targetStudent.id)) {
            throw ExpectedQueueErrors.alreadyInNotifGroup(this.queueName);
        }
        this.notifGroup.set(targetStudent.id, targetStudent);
    }

    /**
     * Adds a student to the notification group.
     * - Used for RemoveNotif button
     */
    async removeFromNotifGroup(targetStudent: GuildMember): Promise<void> {
        if (!this.notifGroup.has(targetStudent.id)) {
            throw ExpectedQueueErrors.notInNotifGroup(this.queueName);
        }
        this.notifGroup.delete(targetStudent.id);
    }

    /**
     * Queue delete procedure, let the extension process first before getting deleted
     */
    async gracefulDelete(): Promise<void> {
        await Promise.all(
            this.queueExtensions.map(extension => extension.onQueueDelete(this))
        );
        this.clearAllQueueTimers();
    }

    /**
     * Re-renders the queue message.
     * Composes the queue view model, then sends it to QueueDisplay
     */
    async triggerRender(): Promise<void> {
        // build viewModel, then call display.render()
        const viewModel: QueueViewModel = {
            queueName: this.queueName,
            helperIDs: [...this._activeHelperIds],
            studentDisplayNames: this._students.map(
                student => student.member.displayName
            ),
            isOpen: this.isOpen,
            seriousModeEnabled: this._seriousModeEnabled,
            timeUntilAutoClear:
                this.timeUntilAutoClear === 'AUTO_CLEAR_DISABLED'
                    ? 'AUTO_CLEAR_DISABLED'
                    : addTimeOffset(
                          new Date(),
                          this.timeUntilAutoClear.hours,
                          this.timeUntilAutoClear.minutes
                      )
        };
        this.display.requestQueueEmbedRender(viewModel);
        await Promise.all(
            this.queueExtensions.map(extension =>
                extension.onQueueRender(this, this.display)
            )
        );
    }

    async triggerForceRender(): Promise<void> {
        await this.display.requestForceRender();
    }

    async setSeriousMode(seriousMode: boolean): Promise<void> {
        this._seriousModeEnabled = seriousMode;
        await this.triggerRender();
    }

    /**
     * Sets up auto clear parameters
     * - The timer won't start until autoClearQueue is called
     * @param hours clear queue after this many hours
     * @param minutes clear queue after this many minutes
     * @param enable whether to enable auto clear, overrides @param hours and @param minutes
     */
    async setAutoClear(hours: number, minutes: number, enable: boolean): Promise<void> {
        const existingTimerId = this.timers.get('QUEUE_AUTO_CLEAR');
        existingTimerId && clearInterval(existingTimerId);
        if (!enable) {
            this._timeUntilAutoClear = 'AUTO_CLEAR_DISABLED';
            this.timers.delete('QUEUE_AUTO_CLEAR');
            await this.triggerRender();
        } else {
            this._timeUntilAutoClear = {
                hours: hours,
                minutes: minutes
            };
            await this.startAutoClearTimer();
        }
    }

    /**
     * Starts the timer that will clear all the students after a certain number of hours
     */
    private async startAutoClearTimer(): Promise<void> {
        const existingTimer = this.timers.get('QUEUE_AUTO_CLEAR');
        existingTimer && clearTimeout(existingTimer);
        if (this._timeUntilAutoClear === 'AUTO_CLEAR_DISABLED') {
            return;
        }
        this.timers.set(
            'QUEUE_AUTO_CLEAR',
            setTimeout(async () => {
                // if the queue is open when the timer finishes, do nothing
                // if auto clear is disabled half way, do nothing
                if (!this.isOpen && this.timeUntilAutoClear !== 'AUTO_CLEAR_DISABLED') {
                    await this.removeAllStudents();
                }
            }, this._timeUntilAutoClear.hours * 1000 * 60 * 60 + this._timeUntilAutoClear.minutes * 1000 * 60)
        );
        await this.triggerRender();
    }
}

export { HelpQueueV2, QueueViewModel, AutoClearTimeout };
