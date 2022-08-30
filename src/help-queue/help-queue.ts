import { GuildMember, Role, TextChannel, User, Collection } from 'discord.js';
import { QueueChannel } from '../attending-server/base-attending-server';
import { IQueueExtension } from '../extensions/extension-interface';
import { Helper, Helpee } from '../models/member-states';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper';
import { QueueError } from '../utils/error-types';
import { QueueDisplayV2 } from './queue-display';

type QueueViewModel = {
    name: string;
    helperIDs: Array<string>;
    studentDisplayNames: Array<string>;
    calendarString?: string;
    isOpen: boolean;
}

class HelpQueueV2 {

    // key is Guildmember.id for both maps
    helpers: Collection<string, Helper> = new Collection();
    students: Required<Helpee>[] = [];

    private queueChannel: QueueChannel;
    private notifGroup: Collection<string, GuildMember> = new Collection();
    private isOpen = false;
    private readonly queueExtensions: IQueueExtension[];
    private readonly display: QueueDisplayV2;

    private constructor(
        user: User,
        queueChannel: QueueChannel,
        queueExtensions: IQueueExtension[]
    ) {
        this.queueChannel = queueChannel;
        this.display = new QueueDisplayV2(user, queueChannel);
        this.queueExtensions = queueExtensions;
        setInterval(async () => {
            await Promise.all(queueExtensions.map(
                ext => ext.onQueuePeriodicUpdate(this, this.display)
            ));
            console.log();
        }, 1000 * 60 * 60 * 24); // emit onQueuePeriodicUpdate every 24 hours
    }

    get length(): number { // number of students
        return this.students.length;
    }
    get currentlyOpen(): boolean { // is the queue open
        return this.isOpen;
    }
    get name(): string { // name of corresponding class
        return this.queueChannel.queueName;
    }
    get channelObj(): Readonly<TextChannel> { // #queue text channel object
        return this.queueChannel.channelObj;
    }
    get first(): Required<Helpee> | undefined { // first student
        return this.students[0];
    }

    /**
     * Asynchronously creates a clean queue
     * ----
     * @param queueChannel the corresponding text channel and its name
     * @param user YABOB's client object. Used for queue rendering
     * @param everyoneRole used for locking the queue
     * @param queueExtensions individual queue extensions to inject
    */
    static async create(
        queueChannel: QueueChannel,
        user: User,
        everyoneRole: Role,
        queueExtensions: IQueueExtension[]
    ): Promise<HelpQueueV2> {
        const queue = new HelpQueueV2(user, queueChannel, queueExtensions);
        await queue.cleanUpQueueChannel();
        await queueChannel.channelObj.permissionOverwrites.create(
            everyoneRole,
            { SEND_MESSAGES: false });
        await queueChannel.channelObj.permissionOverwrites.create(
            user,
            { SEND_MESSAGES: true });
        return queue;
    }

    /**
     * Open a queue with a helper
     * ----
     * @param helperMember member with Staff/Admin that used /start
     * @throws QueueError: do nothing if helperMemeber is already helping
    */
    async openQueue(helperMember: GuildMember): Promise<void> {
        if (this.helpers.has(helperMember.id)) {
            return Promise.reject(new QueueError(
                'Queue is already open',
                this.name));
        } // won't actually be seen, will be caught

        const helper: Helper = {
            helpStart: new Date(),
            helpedMembers: [],
            member: helperMember
        };
        this.isOpen = true;
        this.helpers.set(helperMember.id, helper);

        // queue operations are done
        // safe to launch all these in parallel
        await Promise.all([
            this.notifGroup.map(notifMember => notifMember.send(
                SimpleEmbed(`Queue \`${this.name}\` is open!`)
            )),
            this.queueExtensions.map(extension => extension.onQueueOpen(this))
        ]);
        await this.triggerRender();
    }

    /**
     * Close a queue with a helper
     * ----
     * @param helperMember member with Staff/Admin that used /stop
     * @throws QueueError: do nothing if queue is closed
    */
    async closeQueue(helperMember: GuildMember): Promise<Required<Helper>> {
        const helper = this.helpers.get(helperMember.id);
        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                'Queue is already closed',
                this.name));
        } // won't actually be seen, will be caught 
        if (!helper) {
            return Promise.reject(new QueueError(
                'You are not one of the helpers',
                this.name));
        } // won't actually be seen, will be caught

        this.helpers.delete(helperMember.id);
        this.isOpen = this.helpers.size > 0;
        helper.helpEnd = new Date();

        await Promise.all(this.queueExtensions.map(
            extension => extension.onQueueClose(this))
        );
        await this.triggerRender();
        return helper as Required<Helper>;
    }

    /**
     * Enqueue a student
     * @param student the complete Helpee object
     * @throws QueueError: 
    */
    async enqueue(studentMember: GuildMember): Promise<void> {

        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                `Queue is not open.`,
                this.name));
        }
        if (this.students
            .find(s => s.member.id === studentMember.id) !== undefined) {
            return Promise.reject(new QueueError(
                `You are already in the queue.`,
                this.name
            ));
        }
        if (this.helpers.has(studentMember.id)) {
            return Promise.reject(new QueueError(
                `You can't enqueue yourself while helping.`,
                this.name
            ));
        }

        const student: Helpee = {
            waitStart: new Date(),
            upNext: this.students.length === 0,
            member: studentMember
        };
        this.students.push(student);

        await Promise.all(this.helpers.map(helper =>
            helper.member.send(SimpleEmbed(
                `Heads up! ${student.member.displayName} has joined "${this.name}".`,
                EmbedColor.Neutral,
                `<@${student.member.user.id}>`))
        ));
        await Promise.all(this.queueExtensions.map(
            extension => extension.onQueueClose(this))
        );
        await this.triggerRender();
    }

    /**
     * Dequeue this particular queue with a helper
     * ----
     * @param helperMember the member that triggered dequeue
     * @throws QueueError when
     * - Queue is not open
     * - No student is here
     * - helperMember is not one of the helpers
    */
    async dequeueWithHelper(helperMember: GuildMember): Promise<Readonly<Helpee>> {
        const helper = this.helpers.get(helperMember.id);
        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                'This queue is not open. Did you mean to use `/start`?',
                this.name));
        }
        if (this.students.length === 0) {
            return Promise.reject(new QueueError(
                'There\'s no one in the queue',
                this.name));
        }
        if (!helper) {
            return Promise.reject(new QueueError(
                'You don\'t have permission to help this queue',
                this.name));
        }
        // assertion is safe becasue we already checked for length
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const firstStudent = this.students.shift()!;
        helper.helpedMembers.push(firstStudent.member);
        await Promise.all(this.queueExtensions.map(
            extension => extension.onDequeue(firstStudent))
        );
        await this.triggerRender();
        return firstStudent;
    }

    /**
     * Remove a student from the queue. Used for /leave
     * ----
     * @param targetStudent the student to remove
     * @throws QueueError: the student is not in the queue
    */
    async removeStudent(targetStudent: GuildMember): Promise<void> {
        const idx = this.students
            .findIndex(student => student.member.id === targetStudent.id);
        if (idx === -1) {
            return Promise.reject(new QueueError(
                `${targetStudent.displayName} is not in the queue`,
                this.name
            ));
        }
        // we checked for idx === -1, so it will not be null
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const removedStudent = this.students[idx]!;
        this.students.splice(idx, 1);
        await Promise.all(this.queueExtensions.map(
            extension => extension.onStudentRemove(removedStudent))
        );
        await this.triggerRender();
    }

    /**
     * Remove a student from the queue. Used for /clear
     * ----
    */
    async removeAllStudents(): Promise<void> {
        await Promise.all(this.queueExtensions.map(
            extension => extension.onRemoveAllStudents(this.students))
        );
        this.students = [];
        await this.triggerRender();
    }

    async addToNotifGroup(targetStudent: GuildMember): Promise<void> {
        if (this.notifGroup.has(targetStudent.id)) {
            return Promise.reject(new QueueError(
                'You are already in the notification squad.',
                this.name
            ));
        }
        this.notifGroup.set(targetStudent.id, targetStudent);
    }

    async removeFromNotifGroup(targetStudent: GuildMember): Promise<void> {
        if (!this.notifGroup.has(targetStudent.id)) {
            return Promise.reject(new QueueError(
                'You are not in the notification squad.',
                this.name
            ));
        }
        this.notifGroup.delete(targetStudent.id);
    }

    /**
     * Cleans up the #queue channel
     * ----
    */
    private async cleanUpQueueChannel(): Promise<void> {
        const emptyQueue: QueueViewModel = {
            name: this.name,
            helperIDs: [],
            studentDisplayNames: [],
            calendarString: '',
            isOpen: false
        };
        await Promise.all((await this.queueChannel.channelObj.messages.fetch())
            .map(msg => msg.delete()));
        await this.display.render(emptyQueue, true);
    }

    /**
     * Queue re-render
     * ----
     * Composes the queue view model, then sends it to the queueDisplay class
    */
    private async triggerRender(): Promise<void> {
        // build viewModel, then call display.render()
        const viewModel: QueueViewModel = {
            name: this.name,
            helperIDs: this.helpers.map(helper => `<@${helper.member.id}>`),
            studentDisplayNames: this.students.map(student => student.member.displayName),
            calendarString: '',
            isOpen: this.isOpen
        };
        await this.display.render(viewModel);
        await Promise.all(this.queueExtensions.map(
            extension => extension.onQueueRenderComplete(this, this.display))
        );
    }
}


export { HelpQueueV2, QueueViewModel };