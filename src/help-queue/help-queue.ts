import {
    MemberStateV2,
    Helper,
    Helpee
} from '../models/member-states';

import { QueueDisplayV2 } from './queue-display';

class HelpQueueV2 {
    constructor(
        readonly name: string,
        public helpers: Set<Helper> = new Set(),
        private display: QueueDisplayV2 = new QueueDisplayV2(),
        private students: Helpee[] = [],
        private isOpen: boolean = false
    ) { }

    async openQueue(): Promise<void> {
        if (this.isOpen) {
            throw new Error('The queue is already open.');
        }
        this.isOpen = true;
        this.helpers.forEach(helper => helper.helpStart = new Date());
        await this.display.render();
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
            throw new Error(`Queue ${this.name} is not open.`);
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


    private async triggerRender(): Promise<void> {

        await this.display.render();
    }


    // private render(): Promise<void> {

    // }
}


export { HelpQueueV2 };