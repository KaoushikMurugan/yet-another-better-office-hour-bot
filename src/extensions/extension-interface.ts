/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * !! Important !!
 * ----
 * All extensions will be called with Promise.all()
 * this means that extensions will be launched together
 * To avoid race conditions, do not let extensions modify shared data values
*/

import { ButtonInteraction, CommandInteraction } from "discord.js";
import { AttendingServerV2 } from "../attending-server/base-attending-server";
import { HelpQueueV2 } from "../help-queue/help-queue";
import { QueueDisplayV2 } from "../help-queue/queue-display";
import { Helpee, Helper } from "../models/member-states";
import { ServerBackup } from "./firebase-backup/firebase-models/backups";
import { CommandData } from '../command-handling/slash-commands';

// Command level extensions
interface IInteractionExtension {
    commandMethodMap: ReadonlyMap<
        string,
        (interaction: CommandInteraction) => Promise<string | void>
    >;
    buttonMethodMap: ReadonlyMap<
        string,
        (interaction: ButtonInteraction, queueName: string) =>
            Promise<string | void>
    >;
    slashCommandData: CommandData;
    processCommand: (interaction: CommandInteraction) => Promise<void>;
    processButton: (interaction: ButtonInteraction) => Promise<void>;
}

// Server level extensions
interface IServerExtension {
    onServerInitSuccess: (server: Readonly<AttendingServerV2>) => Promise<void>;
    onAllQueuesInit: (
        server: Readonly<AttendingServerV2>,
        allQueues: ReadonlyArray<HelpQueueV2>
    ) => Promise<void>;
    onQueueDelete: (
        server: Readonly<AttendingServerV2>,
        deletedQueue: Readonly<HelpQueueV2>
    ) => Promise<void>;
    onDequeueFirst: (
        server: Readonly<AttendingServerV2>,
        dequeuedStudent: Readonly<Helpee>
    ) => Promise<void>;
    onHelperStartHelping: (
        server: Readonly<AttendingServerV2>,
        helper: Readonly<Omit<Helper, 'helpEnd'>>
    ) => Promise<void>;
    onHelperStopHelping: (
        server: Readonly<AttendingServerV2>,
        helper: Readonly<Required<Helper>>
    ) => Promise<void>;
    onServerPeriodicUpdate: (
        server: Readonly<AttendingServerV2>,
        isFirstCall: boolean
    ) => Promise<void>;
    loadExternalServerData: (serverId: string) => Promise<ServerBackup | undefined>;
}

// Extensions for individual queues
interface IQueueExtension {
    onQueueCreate: (
        queue: Readonly<HelpQueueV2>,
        display: Readonly<QueueDisplayV2>
    ) => Promise<void>;
    onQueueOpen: (queue: Readonly<HelpQueueV2>) => Promise<void>;
    onQueueClose: (queue: Readonly<HelpQueueV2>) => Promise<void>;
    onEnqueue: (
        queue: Readonly<HelpQueueV2>,
        student: Readonly<Helpee>
    ) => Promise<void>;
    onDequeue: (
        queue: Readonly<HelpQueueV2>,
        student: Readonly<Helpee>
    ) => Promise<void>;
    onStudentRemove: (
        queue: Readonly<HelpQueueV2>,
        student: Readonly<Helpee>
    ) => Promise<void>;
    onRemoveAllStudents: (
        queue: Readonly<HelpQueueV2>,
        students: ReadonlyArray<Helpee>
    ) => Promise<void>;
    onQueueRenderComplete: (
        queue: Readonly<HelpQueueV2>,
        isClenupRender?: boolean
    ) => Promise<void>;
    onQueuePeriodicUpdate: (
        queue: Readonly<HelpQueueV2>,
        isFirstCall: boolean
    ) => Promise<void>;
}

/**
 * Boilerplate base class of interaction related extensions. 
 * ----
 * - Any INTERACTION extension must inherit from here
 * - Always override postExternalSlashCommands() if you want to post your own commands
 * - override processCommand and/or processButton depending on which type you want
*/
class BaseInteractionExtension implements IInteractionExtension {
    buttonMethodMap: ReadonlyMap<
        string,
        (interaction: ButtonInteraction, queueName: string) =>
            Promise<string | void>
    > = new Map();
    commandMethodMap: ReadonlyMap<
        string,
        (interaction: CommandInteraction) => Promise<string | void>
    > = new Map();

    get slashCommandData(): CommandData {
        return [];
    }
    processCommand(interaction: CommandInteraction): Promise<void> {
        return Promise.resolve();
    }
    processButton(interaction: ButtonInteraction): Promise<void> {
        return Promise.resolve();
    }
}

/**
 * Boilerplate base class of server related extensions. 
 * ----
 * - Any SERVER extension must inherit from here
 * - Override the events that you want to trigger
*/
class BaseServerExtension implements IServerExtension {
    onServerInitSuccess(server: Readonly<AttendingServerV2>): Promise<void> {
        return Promise.resolve();
    }
    onAllQueuesInit(
        server: Readonly<AttendingServerV2>,
        allQueues: ReadonlyArray<HelpQueueV2>
    ): Promise<void> {
        return Promise.resolve();
    }
    onQueueDelete(
        server: Readonly<AttendingServerV2>,
        deletedQueue: Readonly<HelpQueueV2>
    ): Promise<void> {
        return Promise.resolve();
    }
    onDequeueFirst(
        server: Readonly<AttendingServerV2>,
        dequeuedStudent: Readonly<Helpee>
    ): Promise<void> {
        return Promise.resolve();
    }
    onHelperStartHelping(
        server: Readonly<AttendingServerV2>,
        helper: Readonly<Omit<Helper, 'helpEnd'>>
    ): Promise<void> {
        return Promise.resolve();
    }
    onHelperStopHelping(
        server: Readonly<AttendingServerV2>,
        helper: Readonly<Required<Helper>>
    ): Promise<void> {
        return Promise.resolve();
    }
    onServerPeriodicUpdate(
        server: Readonly<AttendingServerV2>,
        isFirstCall = false
    ): Promise<void> {
        return Promise.resolve();
    }
    loadExternalServerData(serverId: string): Promise<ServerBackup | undefined> {
        return Promise.resolve(undefined);
    }
}

/**
 * Boilerplate base class of individual-queue related extensions. 
 * ----
 * - Any QUEUE extension must inherit from here
 * - Override the events that you want to trigger
*/
class BaseQueueExtension implements IQueueExtension {
    onQueueCreate(queue: Readonly<HelpQueueV2>, display: Readonly<QueueDisplayV2>): Promise<void> {
        return Promise.resolve();
    }
    onQueueRenderComplete(
        queue: Readonly<HelpQueueV2>,
        isClenupRender?: boolean
    ): Promise<void> {
        return Promise.resolve();
    }
    onQueuePeriodicUpdate(
        queue: Readonly<HelpQueueV2>,
        isFirstCall = false
    ): Promise<void> {
        return Promise.resolve();
    }
    onQueueClose(queue: Readonly<HelpQueueV2>): Promise<void> {
        return Promise.resolve();
    }
    onQueueOpen(queue: Readonly<HelpQueueV2>): Promise<void> {
        return Promise.resolve();
    }
    onEnqueue(
        queue: Readonly<HelpQueueV2>,
        student: Readonly<Helpee>
    ): Promise<void> {
        return Promise.resolve();
    }
    onDequeue(
        queue: Readonly<HelpQueueV2>,
        student: Readonly<Helpee>
    ): Promise<void> {
        return Promise.resolve();
    }
    onStudentRemove(
        queue: Readonly<HelpQueueV2>,
        student: Readonly<Helpee>
    ): Promise<void> {
        return Promise.resolve();
    }
    onRemoveAllStudents(
        queue: Readonly<HelpQueueV2>,
        students: ReadonlyArray<Helpee>
    ): Promise<void> {
        return Promise.resolve();
    }
}

export {
    IInteractionExtension,
    IServerExtension,
    IQueueExtension,
    BaseInteractionExtension,
    BaseServerExtension,
    BaseQueueExtension,
};