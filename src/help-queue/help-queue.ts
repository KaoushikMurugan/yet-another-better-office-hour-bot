import { GuildMember, Role, TextChannel, User } from 'discord.js';
import { QueueChannel } from '../attending-server/base-attending-server';
import { IQueueExtension } from '../extensions/base-interface';
import { Helper, Helpee } from '../models/member-states';
import { SimpleEmbed } from '../utils/embed-helper';
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

    helpers: Map<string, Helper> = new Map(); // key is Guildmember.id

    private queueChannel: QueueChannel;
    private students: Required<Helpee>[] = [];
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
    }

    get length(): number {
        return this.students.length;
    }
    get currentlyOpen(): boolean {
        return this.isOpen;
    }
    get name(): string {
        return this.queueChannel.queueName;
    }
    get channelObj(): Readonly<TextChannel> {
        return this.queueChannel.channelObj;
    }
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

        await Promise.all(this.queueExtensions.map(
            extension => extension.onQueueOpen())
        );
        await this.triggerRender();
    }

    async closeQueue(helperMember: GuildMember): Promise<Required<Helper>> {
        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                'Queue is already closed',
                this.name));
        } // won't actually be seen, will be caught
        const helper = this.helpers.get(helperMember.id);
        if (!helper) {
            return Promise.reject(new QueueError(
                'You are not one of the helpers',
                this.name));
        } // won't actually be seen, will be caught
        this.helpers.delete(helperMember.id);
        this.isOpen = this.helpers.size > 0;
        helper.helpEnd = new Date();

        await Promise.all(this.queueExtensions.map(
            extension => extension.onQueueClose())
        );
        await this.triggerRender();
        return helper as Required<Helper>;
    }

    async enqueue(student: Helpee): Promise<void> {
        if (!this.isOpen) {
            return Promise.reject(new QueueError(
                `Queue is not open.`,
                this.name));
        }
        if (this.students
            .find(s => s.member.id === student.member.id) !== undefined) {
            return Promise.reject(new QueueError(
                `You are already in the queue.`,
                this.name
            ));
        }
        if (this.helpers.has(student.member.id)) {
            return Promise.reject(new QueueError(
                `You can't enqueue yourself while helping.`,
                this.name
            ));
        }
        if (this.students.length === 0) {
            student.upNext = true;
        }
        student.waitStart = new Date();
        this.students.push(student);
        await Promise.all([...this.helpers.values()].map(helper =>
            helper.member.send(SimpleEmbed(
                `Heads up! <@${student.member.user.id}> has joined "${this.name}".`
            ))
        ));
        await Promise.all(this.queueExtensions.map(
            extension => extension.onQueueClose())
        );
        await this.triggerRender();
    }

    async dequeueWithHelper(helperMember: GuildMember): Promise<Readonly<Helpee>> {
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

        const helper = this.helpers.get(helperMember.id);
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
            extension => extension.onDequeue())
        );
        await this.triggerRender();
        return firstStudent;
    }

    async removeStudent(targetStudent: GuildMember): Promise<void> {
        const idx = this.students
            .findIndex(student => student.member.id === targetStudent.id);
        if (idx === -1) {
            return Promise.reject(new QueueError(
                `${targetStudent.displayName} is not in the queue`,
                this.name
            ));
        }
        this.students.splice(idx, 1);
        await Promise.all(this.queueExtensions.map(
            extension => extension.onStudentRemove())
        );
        await this.triggerRender();
    }

    async removeAllStudents(): Promise<void> {
        this.students = [];
        await Promise.all(this.queueExtensions.map(
            extension => extension.onRemoveAllStudents())
        );
        await this.triggerRender();
    }

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

    private async triggerRender(): Promise<void> {
        // build viewModel, then call display.render()
        const viewModel: QueueViewModel = {
            name: this.name,
            helperIDs: [...this.helpers.values()]
                .map(helper => `<@${helper.member.id}>`),
            studentDisplayNames: [... this.students.values()]
                .map(student => student.member.displayName),
            calendarString: '',
            isOpen: this.isOpen
        };
        await this.display.render(viewModel);
        await Promise.all(this.queueExtensions.map(
            extension => extension.onQueueRenderComplete())
        );
    }
}


export { HelpQueueV2, QueueViewModel };