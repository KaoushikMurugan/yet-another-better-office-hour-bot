import { GuildMember, Role, User } from 'discord.js';
import { QueueChannel } from '../attending-server/base-attending-server';
import {
    Helper,
    Helpee
} from '../models/member-states';
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

    public queueChannel: QueueChannel;
    public helpers: Map<string, Helper> = new Map(); // key is Guildmember.id
    private display: QueueDisplayV2;
    private students: Required<Helpee>[] = [];
    private isOpen = false;

    private constructor(
        user: User,
        queueChannel: QueueChannel
    ) {
        this.queueChannel = queueChannel;
        this.display = new QueueDisplayV2(user, queueChannel);
    }

    /**
     * Number of students
     * ----
    */
    get length(): number {
        return this.students.length;
    }
    get currentlyOpen(): boolean {
        return this.isOpen;
    }
    get name(): string {
        return this.queueChannel.queueName;
    }
    /**
     * Returns the first students in the queue
     * ----
     * if there are no students, returns undefined
    */
    get first(): Required<Helpee> | undefined {
        return this.students[0];
    }

    /**
     * Asynchronously creates a clean queue
     * ----
     * @param queueChannel the corresponding text channel and its name
    */
    static async create(
        queueChannel: QueueChannel,
        user: User,
        everyoneRole: Role): Promise<HelpQueueV2> {
        const queue = new HelpQueueV2(user, queueChannel);
        await queue.cleanUpQueueChannel();
        await queueChannel.channelObj.permissionOverwrites.create(
            everyoneRole,
            { SEND_MESSAGES: false });
        await queueChannel.channelObj.permissionOverwrites.create(
            user,
            { SEND_MESSAGES: true });
        return queue;
    }

    async openQueue(member: GuildMember): Promise<void> {
        if (this.isOpen) {
            return Promise.reject(new QueueError(
                'Queue is already open',
                this.queueChannel.queueName));
        } // won't actually be seen, will be caught
        const helper: Helper = {
            helpStart: new Date(),
            helpedMembers: [],
            member: member
        };
        this.isOpen = true;
        this.helpers.set(member.id, helper);
        await this.triggerRender();
    }

    async closeQueue(): Promise<void> {
        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                'Queue is already closed',
                this.queueChannel.queueName));
        } // won't actually be seen, will be caught
        this.isOpen = false;
        this.helpers.forEach(helper => helper.helpEnd = new Date());
        await this.triggerRender();
    }

    async enqueue(student: Helpee): Promise<void> {
        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                `Queue is not open.`,
                this.queueChannel.queueName));
        }
        student.waitStart = new Date();
        if (this.students.length === 0) {
            student.upNext = true;
        }
        this.students.push(student);
        await this.triggerRender();
    }

    async dequeueWithHelper(member: GuildMember): Promise<void> {
        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                'This queue is not open. Did you mean to use `/start`?',
                this.queueChannel.queueName));
        }
        if (this.students.length === 0) {
            return Promise.reject(new QueueError(
                'There\'s no one in the queue',
                this.queueChannel.queueName));
        }

        const helper = this.helpers.get(member.id);
        if (!helper) {
            return Promise.reject(new QueueError(
                'You don\'t have permission to help this queue',
                this.queueChannel.queueName));
        }
        // assertion is safe becasue we already checked for length
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const firstStudent = this.students.shift()!;
        helper.helpedMembers.push(firstStudent.member);
        await this.triggerRender();
    }

    private async cleanUpQueueChannel(): Promise<void> {
        const emptyQueue: QueueViewModel = {
            name: this.queueChannel.queueName,
            helperIDs: [],
            studentDisplayNames: [],
            calendarString: '',
            isOpen: false
        };
        await Promise.all((await this.queueChannel.channelObj.messages.fetch())
            .map(msg => msg.delete()));
        await this.display.render(emptyQueue, true);
    }

    private async triggerRender(): Promise<void> {
        // build viewModel, then call display.render();
        const viewModel: QueueViewModel = {
            name: this.queueChannel.queueName,
            helperIDs: [...this.helpers.values()]
                .map(helper => helper.member.id),
            studentDisplayNames: [... this.students.values()]
                .map(student => student.member.displayName),
            calendarString: '',
            isOpen: this.isOpen
        };

        await this.display.render(viewModel);
    }
}


export { HelpQueueV2, QueueViewModel };