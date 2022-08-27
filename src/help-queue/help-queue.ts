import { User } from 'discord.js';
import { QueueChannel } from '../attending-server/base-attending-server';
import {
    Helper,
    Helpee
} from '../models/member-states';

import { QueueDisplayV2 } from './queue-display';

type If<T extends boolean, A, B = null> = T extends true ? A : T extends false ? B : A | B;

type QueueViewModel = {
    name: string;
    helperIDs: Array<string>;
    studentIDs: Array<string>;
    calendarString?: string;
    isOpen: boolean;
}

class HelpQueueV2 {

    public queueChannel: QueueChannel;
    public helpers: Set<Helper> = new Set();
    private display: QueueDisplayV2;
    private students: Helpee[] = [];
    private isOpen = false;

    private constructor(
        user: User,
        queueChannel: QueueChannel
    ) {
        this.queueChannel = queueChannel;
        this.display = new QueueDisplayV2(queueChannel, user);
    }

    /**
     * Number of students
     * ----
    */
    get length(): number {
        return this.students.length;
    }
    /**
     * Returns the first students in the queue
     * ----
     * if there are no students, returns undefined
    */
    first(): Helpee | undefined {
        return this.students[0];
    }

    /**
     * Asynchronously creates a clean queue
     * ----
     * @param queueChannel the corresponding text channel and its name
    */
    static async create(
        queueChannel: QueueChannel,
        user: User): Promise<HelpQueueV2> {
        const queue = new HelpQueueV2(user, queueChannel);
        await queue.cleanUpQueueChannel();
        return queue;
    }

    async openQueue(): Promise<void> {
        if (this.isOpen) {
            throw new Error('The queue is already open.');
        }
        this.isOpen = true;
        this.helpers.forEach(helper => helper.helpStart = new Date());
        await this.triggerRender();
    }

    async closeQueue(): Promise<void> {
        if (this.isOpen) {
            throw new Error('You are not currently hosting.');
        }
        this.isOpen = false;
        this.helpers.forEach(helper => helper.helpEnd = new Date());
        await this.triggerRender();
    }

    async enqueue(student: Helpee): Promise<void> {
        if (!this.isOpen) {
            throw new Error(`Queue ${this.queueChannel.queueName} is not open.`);
        }
        student.waitStart = new Date();
        this.students.push(student);
        await this.triggerRender();
    }

    async dequeue(helper: Helper): Promise<void> {
        if (!this.helpers.has(helper)) {
            throw new Error('You don\'t have permission to help this queue');
        }
        if (this.students.length === 0) {
            throw new Error('There\'s no one in the queue');
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
            studentIDs: [],
            calendarString: '',
            isOpen: false
        };
        await Promise.all((await this.queueChannel.channelObject.messages.fetch())
            .map(msg => msg.delete()));
        await this.display.render(emptyQueue, true);
        console.log(`Queue ${this.queueChannel.queueName} cleaned up.`);
    }

    private async triggerRender(): Promise<void> {
        // build viewModel, then call display.render();
        const viewModel: QueueViewModel = {
            name: this.queueChannel.queueName,
            helperIDs: [...this.helpers.values()]
                .map(helper => helper.member.id),
            studentIDs: [... this.students.values()]
                .map(student => student.member.displayName),
            calendarString: '',
            isOpen: this.isOpen
        };

        await this.display.render(viewModel);
    }
}


export { HelpQueueV2, QueueViewModel };