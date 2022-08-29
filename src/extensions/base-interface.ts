/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * !! Important !!
 * ----
 * All extensions will be called with Promise.all()
 * this means that extensions will be launched in parallel
 * To avoid race conditions, do not let extensions modify shared data values
*/

import { HelpQueueV2 } from "../help-queue/help-queue";
import { Helpee, Helper } from "../models/member-states";

// Server only extensions
interface IServerExtension {
    onServerInitSuccess: () => Promise<void>;
    onAllQueueInit: () => Promise<void>;
    onQueueDelete: () => Promise<void>;
    onDequeueFirst: (dequeuedStudent: Readonly<Helpee>) => Promise<void>;
    onHelperStartHelping: (helper: Readonly<Omit<Helper, 'helpEnd'>>) => Promise<void>;
    onHelperStopHelping: (helper: Readonly<Required<Helper>>) => Promise<void>;
}

// Extensions for individual queues
interface IQueueExtension {
    onQueueCreate: (queue: Readonly<HelpQueueV2>) => Promise<void>;
    onQueueRenderComplete: () => Promise<void>;
    onQueueClose: (queue: Readonly<HelpQueueV2>) => Promise<void>;
    onQueueOpen: (queue: Readonly<HelpQueueV2>) => Promise<void>;
    onEnqueue: (student: Readonly<Helpee>) => Promise<void>;
    onDequeue: (student: Readonly<Helpee>) => Promise<void>;
    onStudentRemove: (student: Readonly<Helpee>) => Promise<void>;
    onRemoveAllStudents: (students: Readonly<Helpee[]>) => Promise<void>;
}

/**
 * Boilerplate base class of server related extensions. 
 * ----
 * - Any SERVER extension must inherit from here
 * - Override the events that you want to trigger
*/
class BaseServerExtension implements IServerExtension {
    onServerInitSuccess(): Promise<void> {
        return Promise.resolve();
    }
    onAllQueueInit(): Promise<void> {
        return Promise.resolve();
    }
    onQueueDelete(): Promise<void> {
        return Promise.resolve();
    }
    onDequeueFirst(): Promise<void> {
        return Promise.resolve();
    }
    onHelperStartHelping(helper: Readonly<Omit<Helper, 'helpEnd'>>): Promise<void> {
        return Promise.resolve();
    }
    onHelperStopHelping(helper: Readonly<Required<Helper>>): Promise<void> {
        return Promise.resolve();
    }
}

/**
 * Boilerplate base class of individual-queue related extensions. 
 * ----
 * - Any QUEUE extension must inherit from here
 * - Override the events that you want to trigger
*/
class BaseQueueExtension implements IQueueExtension {
    onQueueCreate(queue: Readonly<HelpQueueV2>): Promise<void> {
        return Promise.resolve();
    }
    onQueueRenderComplete(): Promise<void> {
        return Promise.resolve();
    }
    onQueueClose(queue: Readonly<HelpQueueV2>): Promise<void> {
        return Promise.resolve();
    }
    onQueueOpen(queue: Readonly<HelpQueueV2>): Promise<void> {
        return Promise.resolve();
    }
    onEnqueue(student: Readonly<Helpee>): Promise<void> {
        return Promise.resolve();
    }
    onDequeue(student: Readonly<Helpee>): Promise<void> {
        return Promise.resolve();
    }
    onStudentRemove(student: Readonly<Helpee>): Promise<void> {
        return Promise.resolve();
    }
    onRemoveAllStudents(students: Readonly<Helpee[]>): Promise<void> {
        return Promise.resolve();
    }
}

class ExtensionSetupError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ExtensionSetupError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

export {
    IServerExtension,
    IQueueExtension,
    BaseServerExtension,
    BaseQueueExtension,
    ExtensionSetupError
};