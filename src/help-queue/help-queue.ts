import { GuildMember, Role, TextChannel, User, Collection, Message } from 'discord.js';
import { QueueChannel } from '../attending-server/base-attending-server';
import { CalendarQueueExtension } from '../extensions/session-calendar/calendar-queue-extension';
import { IQueueExtension } from '../extensions/extension-interface';
import { QueueBackup } from '../models/backups';
import { Helpee } from '../models/member-states';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper';
import { PeriodicUpdateError, QueueError } from '../utils/error-types';
import { QueueDisplayV2 } from './queue-display';
import { GuildMemberId } from '../utils/type-aliases';
import environment from '../environment/environment-manager';

type QueueViewModel = {
    queueName: string;
    helperIDs: Array<string>;
    studentDisplayNames: Array<string>;
    isOpen: boolean;
}

type QueueTimerType = 'QUEUE_PERIODIC_UPDATE' | 'QUEUE_AUTO_CLEAR';

type AutoClearTimeout = number | 'AUTO_CLEAR_DISABLED';

class HelpQueueV2 {
    // Keeps track of all the setTimout/setIntervals we started
    timers: Collection<QueueTimerType, NodeJS.Timer | NodeJS.Timeout> = new Collection();
    // set of active helpers' ids
    private _activeHelperIds: Set<string> = new Set();
    // queue of students
    private _students: Helpee[] = [];
    // Key is Guildmember.id
    private notifGroup: Collection<GuildMemberId, GuildMember> = new Collection();
    // open status
    private isOpen = false;
    // when to automatically remove everyone
    private _hoursUntilAutoClear: AutoClearTimeout = 'AUTO_CLEAR_DISABLED';

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
        backupData?: QueueBackup & { hoursUntilAutoClear: AutoClearTimeout }
    ) {
        this.display = new QueueDisplayV2(user, queueChannel);
        if (backupData === undefined) {
            // if no backup then we are done initializing
            return;
        }
        this._hoursUntilAutoClear = backupData.hoursUntilAutoClear;
        for (const studentBackup of backupData.studentsInQueue) {
            // forEach backup, if there's a corresponding channel member, push it into queue
            const correspondingMember = this.queueChannel.channelObj.members
                .get(studentBackup.memberId);
            if (correspondingMember !== undefined) {
                this._students.push({
                    waitStart: studentBackup.waitStart,
                    upNext: studentBackup.upNext,
                    member: correspondingMember,
                    queue: this
                });
            }
        }
    }

    get length(): number { // number of students
        return this._students.length;
    }
    get currentlyOpen(): boolean { // is the queue open
        return this.isOpen;
    }
    get queueName(): string { // name of corresponding queue
        return this.queueChannel.queueName;
    }
    get channelObj(): Readonly<TextChannel> { // #queue text channel object
        return this.queueChannel.channelObj;
    }
    get parentCategoryId(): string {
        return this.queueChannel.parentCategoryId;
    }
    get first(): Helpee | undefined { // first student; undefined if no one is here
        return this._students[0];
    }
    get students(): ReadonlyArray<Helpee> {
        return this._students;
    }
    get activeHelperIds(): ReadonlySet<string> { // set of helper IDs. enforce readonly
        return this._activeHelperIds;
    }
    get hoursUntilAutoClear(): AutoClearTimeout {
        return this._hoursUntilAutoClear;
    }

    clearAllQueueTimers(): void {
        this.timers.forEach(clearInterval);
        this.timers.clear();
    }

    /**
     * Sets up auto clear parameters
     * - The timer won't start until autoClearQueue is called
     * ----
     * @param hours clear queue after this many hours
     * @param enable whether to enable auto clear, overrides 'hours'
    */
    setAutoClear(hours: number, enable: boolean): void {
        const existingTimerId = this.timers.get('QUEUE_AUTO_CLEAR');
        if (!enable) {
            existingTimerId && clearInterval(existingTimerId);
            this.timers.delete('QUEUE_AUTO_CLEAR');
            this._hoursUntilAutoClear = 'AUTO_CLEAR_DISABLED';
            return;
        }
        this._hoursUntilAutoClear = hours;
    }

    /**
     * Asynchronously creates a clean queue
     * ----
     * @param queueChannel the corresponding text channel and its name
     * @param user YABOB's client object. Used for queue rendering
     * @param everyoneRole used for locking the queue
     * @param backupData backup queue data directly passed to the constructor
    */
    static async create(
        queueChannel: QueueChannel,
        user: User,
        everyoneRole: Role,
        backupData?: QueueBackup & { hoursUntilAutoClear: AutoClearTimeout }
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
        await Promise.all(queueExtensions.map(extension =>
            extension.onQueueCreate(queue))
        );
        await Promise.all(queueExtensions.map(extension =>
            extension.onQueuePeriodicUpdate(queue, true))
        );
        await Promise.all([
            queueChannel.channelObj.permissionOverwrites.create(
                everyoneRole,
                {
                    SEND_MESSAGES: false,
                    CREATE_PRIVATE_THREADS: false,
                    CREATE_PUBLIC_THREADS: false,
                    ADD_REACTIONS: false
                }
            ),
            queue.triggerRender()
        ]);
        queue.timers.set('QUEUE_PERIODIC_UPDATE', setInterval(async () =>
            await Promise.all(queueExtensions.map(
                extension => extension.onQueuePeriodicUpdate(queue, false)
            )).catch((err: Error) => console.error(new PeriodicUpdateError(
                `${err.name}: ${err.message}`,
                'Queue'
            ))), // Random 0~2min offset to avoid spamming the APIs
            (1000 * 60 * 10) + Math.floor(Math.random() * 1000 * 60 * 2)
        ));
        return queue;
    }

    /**
     * Open a queue with a helper
     * ----
     * @param helperMember member with Staff/Admin that used /start
     * @param notify whether to notify everyone in the notif group
     * @throws QueueError: do nothing if helperMemeber is already helping
    */
    async openQueue(helperMember: GuildMember, notify: boolean): Promise<void> {
        if (this._activeHelperIds.has(helperMember.id)) {
            return Promise.reject(new QueueError(
                'Queue is already open',
                this.queueName));
        } // won't actually be seen, will be caught
        this.isOpen = true;
        this._activeHelperIds.add(helperMember.id);
        await Promise.all<void | boolean | Message<boolean>>([
            // shorthand syntax, the RHS of && will be invoked if LHS is true
            this.notifGroup.map(notifMember => notify && notifMember.send(
                SimpleEmbed(`Queue \`${this.queueName}\` is open!`)
            )),
            this.queueExtensions.map(extension => extension.onQueueOpen(this)),
            notify && this.notifGroup.clear(),
            this.triggerRender()
        ].flat());
    }

    /**
     * Close a queue with a helper
     * ----
     * @param helperMember member with Staff/Admin that used /stop
     * @throws QueueError: do nothing if queue is closed
    */
    async closeQueue(helperMember: GuildMember): Promise<void> {
        // These will be caught and show 'You are not currently helping'
        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                'Queue is already closed',
                this.queueName));
        }
        if (!this._activeHelperIds.has(helperMember.id)) {
            return Promise.reject(new QueueError(
                'You are not one of the helpers',
                this.queueName));
        }
        this._activeHelperIds.delete(helperMember.id);
        this.isOpen = this._activeHelperIds.size > 0;
        if (!this.isOpen) {
            this.startAutoClearTimer();
        }
        await Promise.all([
            this.queueExtensions.map(extension => extension.onQueueClose(this)),
            this.triggerRender()
        ].flat());
    }

    /**
     * Enqueue a student
     * @param studentMember the complete Helpee object
     * @throws QueueError
    */
    async enqueue(studentMember: GuildMember): Promise<void> {
        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                `Queue is not open.`,
                this.queueName
            ));
        }
        if (this._students
            .find(s => s.member.id === studentMember.id) !== undefined) {
            return Promise.reject(new QueueError(
                `You are already in the queue.`,
                this.queueName
            ));
        }
        if (this._activeHelperIds.has(studentMember.id)) {
            return Promise.reject(new QueueError(
                `You can't enqueue yourself while helping.`,
                this.queueName
            ));
        }
        const student: Helpee = {
            waitStart: new Date(),
            upNext: this._students.length === 0,
            member: studentMember,
            queue: this
        };
        this._students.push(student);
        // converted to use Array.map
        const helperIdArray = [...this._activeHelperIds];
        // the Promise<void> cast is for combining 2 different promise types
        // so that they can be launched in parallel
        // we won't use the return values so it's safe to cast
        await Promise.all<void | undefined | Message<boolean>>([
            helperIdArray.map(helperId =>
                this.queueChannel.channelObj.members
                    .get(helperId)
                    ?.send(SimpleEmbed(
                        `Heads up! ${student.member.displayName} has joined '${this.queueName}'.`,
                        EmbedColor.Neutral,
                        `<@${student.member.user.id}>`))
            ),
            this.queueExtensions.map(extension => extension.onEnqueue(this, student)),
            this.triggerRender()
        ].flat());
    }

    /**
     * Dequeue this particular queue with a helper
     * ----
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
            return Promise.reject(new QueueError(
                'This queue is not open. Did you mean to use `/start`?',
                this.queueName
            ));
        }
        if (this._students.length === 0) {
            return Promise.reject(new QueueError(
                'There\'s no one in the queue',
                this.queueName
            ));
        }
        if (!this._activeHelperIds.has(helperMember.id)) {
            return Promise.reject(new QueueError(
                'You don\'t have permission to help this queue',
                this.queueName
            ));
        }
        if (targetStudentMember !== undefined) {
            const studentIndex = this._students
                .findIndex(student => student.member.id === targetStudentMember.id);
            if (studentIndex === -1) {
                return Promise.reject(new QueueError(
                    `The specified student ${targetStudentMember.displayName} ` +
                    `is not in the queue`,
                    this.queueChannel.queueName
                ));
            }
            // already checked for idx === -1
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const foundStudent = this._students[studentIndex]!;
            this._students.splice(studentIndex, 1);
            await Promise.all([
                this.queueExtensions.map(
                    extension => extension.onDequeue(this, foundStudent)),
                this.triggerRender()
            ].flat());
            return foundStudent;
        }
        // assertion is safe becasue we already checked for length
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const firstStudent = this._students.shift()!;
        await Promise.all([
            this.queueExtensions.map(
                extension => extension.onDequeue(this, firstStudent)),
            await this.triggerRender()
        ].flat());
        return firstStudent;
    }

    /**
     * Remove a student from the queue. Used for /leave
     * ----
     * @param targetStudent the student to remove
     * @throws QueueError: the student is not in the queue
    */
    async removeStudent(targetStudent: GuildMember): Promise<Helpee> {
        const idx = this._students
            .findIndex(student => student.member.id === targetStudent.id);
        if (idx === -1) {
            return Promise.reject(new QueueError(
                `${targetStudent.displayName} is not in the queue`,
                this.queueName
            ));
        }
        // we checked for idx === -1, so it will not be null
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const removedStudent = this._students[idx]!;
        this._students.splice(idx, 1);
        await Promise.all([
            this.queueExtensions.map(
                extension => extension.onStudentRemove(this, removedStudent)),
            this.triggerRender()
        ].flat());
        return removedStudent;
    }

    /**
     * Remove all students from the queue. Used for /clear_all
     * ----
    */
    async removeAllStudents(): Promise<void> {
        await Promise.all(this.queueExtensions.map(
            extension => extension.onRemoveAllStudents(this, this._students))
        );
        if (this._students.length !== 0) {
            // avoid unnecessary render
            this._students = [];
            await this.triggerRender();
        }
    }

    /**
     * Adds a student to the notification group.
     * ----
     * Used for JoinNotif button
    */
    async addToNotifGroup(targetStudent: GuildMember): Promise<void> {
        if (this.notifGroup.has(targetStudent.id)) {
            return Promise.reject(new QueueError(
                'You are already in the notification squad.',
                this.queueName
            ));
        }
        this.notifGroup.set(targetStudent.id, targetStudent);
    }

    /**
     * Adds a student to the notification group.
     * ----
     * Used for RemoveNotif button
    */
    async removeFromNotifGroup(targetStudent: GuildMember): Promise<void> {
        if (!this.notifGroup.has(targetStudent.id)) {
            return Promise.reject(new QueueError(
                'You are not in the notification squad.',
                this.queueName
            ));
        }
        this.notifGroup.delete(targetStudent.id);
    }

    /**
     * Queue delete procedure, let the extension process first before getting deleted
     * ----
    */
    async gracefulDelete(): Promise<void> {
        await Promise.all(this.queueExtensions.map(
            extension => extension.onQueueDelete(this)
        ));
    }

    /**
     * Re-renders the queue message.
     * ----
     * Composes the queue view model, then sends it to QueueDisplay
    */
    async triggerRender(): Promise<void> {
        // build viewModel, then call display.render()
        const viewModel: QueueViewModel = {
            queueName: this.queueName,
            helperIDs: [...this._activeHelperIds].map(helperId => `<@${helperId}>`),
            studentDisplayNames: this._students.map(student => student.member.displayName),
            isOpen: this.isOpen
        };
        await Promise.all([
            this.display.requestQueueRender(viewModel),
            this.queueExtensions.map(
                extension => extension.onQueueRender(this, this.display))
        ].flat());
    }

    /**
     * Starts the timer that will clear all the students after a certain number of hours
     * ----
    */
    private startAutoClearTimer(): void {
        const existingTimer = this.timers.get('QUEUE_AUTO_CLEAR');
        existingTimer && clearTimeout(existingTimer);
        if (this._hoursUntilAutoClear === 'AUTO_CLEAR_DISABLED') {
            return;
        }
        this.timers.set('QUEUE_AUTO_CLEAR', setTimeout(async () => {
            // if the queue is open when the timer finishes, do nothing
            // if auto clear is disabled half way, do nothing
            if (!this.isOpen && this.hoursUntilAutoClear !== 'AUTO_CLEAR_DISABLED') {
                await this.removeAllStudents();
            }
        }, this._hoursUntilAutoClear * 1000 * 60 * 60));
    }
}

export { HelpQueueV2, QueueViewModel, AutoClearTimeout };