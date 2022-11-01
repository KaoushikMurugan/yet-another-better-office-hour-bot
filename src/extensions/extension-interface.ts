/**
 * !! Important !!
 * All extensions will be called with Promise.all()
 * this means that extensions will be launched together
 * To avoid race conditions, do not let extensions modify shared data values
 * @module ExtensionInterface
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    GuildMember,
    VoiceChannel,
    ModalSubmitInteraction
} from 'discord.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { HelpQueueV2 } from '../help-queue/help-queue.js';
import { QueueDisplayV2 } from '../help-queue/queue-display.js';
import { Helpee, Helper } from '../models/member-states.js';
import { ServerBackup } from '../models/backups.js';
import { CommandData } from '../command-handling/slash-commands.js';
import { Optional } from '../utils/type-aliases.js';

/** Server Level Extension */
interface IInteractionExtension {
    /**
     * The command data json to post to the discord server
     */
    slashCommandData: CommandData;
    /**
     * Whether the extension can handle slash commands.
     * @param interaction the slash command to test
     */
    canHandleCommand: (interaction: ChatInputCommandInteraction<'cached'>) => boolean;
    /**
     * Whether the extension can handle buttons
     * @param interaction the button to test
     */
    canHandleButton: (interaction: ButtonInteraction<'cached'>) => boolean;
    /**
     * Whether the extension can handle modal submit
     * @param interaction the modal to test
     */
    canHandleModalSubmit: (interaction: ModalSubmitInteraction<'cached'>) => boolean;
    /**
     * Interface to the command processor. If the extension can handle this slash command,
     * it should reply inside this method
     * @param interaction the slash command that's guaranteed to be handled by this extension
     */
    processCommand: (interaction: ChatInputCommandInteraction<'cached'>) => Promise<void>;
    /**
     * Interface to the button processor. If the extension can handle this button,
     * it should reply inside this method
     * @param interaction the button that's guaranteed to be handled by this extension
     */
    processButton: (interaction: ButtonInteraction<'cached'>) => Promise<void>;
    /**
     * Interface to the modal submit processor. If the extension can handle this button,
     * it should reply inside this method
     * @param interaction the modal that's guaranteed to be handled by this extension
     */
    processModalSubmit: (interaction: ModalSubmitInteraction<'cached'>) => Promise<void>;
}

/** Server Level Extension */
interface IServerExtension {
    /**
     * When a server instance is successfully created
     * @param server the newly created server
     */
    onServerInitSuccess: (server: Readonly<AttendingServerV2>) => Promise<void>;
    /**
     * When all the queues are successfully created.
     * Happens before {@link onServerInitSuccess}
     * @param server
     * @param allQueues
     */
    onAllQueuesInit: (
        server: Readonly<AttendingServerV2>,
        allQueues: ReadonlyArray<HelpQueueV2>
    ) => Promise<void>;
    /**
     * When a student is dequeued
     * @param server which server is this student from
     * @param dequeuedStudent the newly dequeued student
     */
    onDequeueFirst: (
        server: Readonly<AttendingServerV2>,
        dequeuedStudent: Readonly<Helpee>
    ) => Promise<void>;
    /**
     * When a helper starts helping. Called after `/start`
     * @param server which server is this helper from
     * @param helper the helper that used `start`
     */
    onHelperStartHelping: (
        server: Readonly<AttendingServerV2>,
        helper: Readonly<Omit<Helper, 'helpEnd'>>
    ) => Promise<void>;
    /**
     * When a helper stops helping. Called after `/stop`
     * @param server which server is this helper from
     * @param helper the helper that used `stop`
     */
    onHelperStopHelping: (
        server: Readonly<AttendingServerV2>,
        helper: Readonly<Required<Helper>>
    ) => Promise<void>;
    /**
     * Called every 15 minutes
     * @param server the object
     * @param isFirstCall whether this is called inside server init
     * @deprecated will likely be removed in the future
     */
    onServerPeriodicUpdate: (
        server: Readonly<AttendingServerV2>,
        isFirstCall: boolean
    ) => Promise<void>;
    /**
     * When a student that just dequeued joins the voice channel
     * @param server which server is this student from
     * @param studentMember the student guild member object
     * @param voiceChannel non-null voice channel
     */
    onStudentJoinVC: (
        server: Readonly<AttendingServerV2>,
        studentMember: GuildMember,
        voiceChannel: VoiceChannel
    ) => Promise<void>;
    /**
     * When a student finishes receiving help and leaves the voice channel
     * @param server which server is this student from
     * @param studentMember the student guild member object
     */
    onStudentLeaveVC: (
        server: Readonly<AttendingServerV2>,
        studentMember: GuildMember
    ) => Promise<void>;
    /**
     * When YABOB is kicked from a server.
     * Extensions should override this method to do any necessary cleanup
     * @param server the server that just got deleted
     */
    onServerDelete: (server: Readonly<AttendingServerV2>) => Promise<void>;
    /**
     * When the server asks for external backup data. Called inside AttendingServerV2.create
     * @param serverId the guild id
     * @returns Optional backup. If no extension provides backups, start fresh
     */
    loadExternalServerData: (serverId: string) => Promise<Optional<ServerBackup>>;
    /**
     * When the server requests backups.
     * Currently, only queue related changes will trigger this call
     * @param server the server to backup
     */
    onServerRequestBackup: (server: Readonly<AttendingServerV2>) => Promise<void>;
}

/** Extensions for individual queues */
interface IQueueExtension {
    /**
     * When a single queue is created
     * @param queue the newly created queue
     */
    onQueueCreate: (queue: Readonly<HelpQueueV2>) => Promise<void>;
    /**
     * When a queue opens
     * @param queue the newly opened queue
     */
    onQueueOpen: (queue: Readonly<HelpQueueV2>) => Promise<void>;
    /**
     * When a queue closes
     * @param queue the newly closed queue
     */
    onQueueClose: (queue: Readonly<HelpQueueV2>) => Promise<void>;
    /**
     * When a student joins the queue
     * @param queue the queue that the students joined
     * @param student the student that just joined
     */
    onEnqueue: (queue: Readonly<HelpQueueV2>, student: Readonly<Helpee>) => Promise<void>;
    /**
     * When a student is dequeued by a helper using `/next`
     * @param queue the queue that the students just left
     * @param student the newly dequeued student
     */
    onDequeue: (queue: Readonly<HelpQueueV2>, student: Readonly<Helpee>) => Promise<void>;
    /**
     * When a student leaves the queue with `/leave` or [LEAVE]
     * @param queue the queue that the students just left
     * @param student the newly left student
     */
    onStudentRemove: (
        queue: Readonly<HelpQueueV2>,
        student: Readonly<Helpee>
    ) => Promise<void>;
    /**
     * When `clear` is used
     * @param queue queue after clearing everyone
     * @param students the students that just got cleared
     */
    onRemoveAllStudents: (
        queue: Readonly<HelpQueueV2>,
        students: ReadonlyArray<Helpee>
    ) => Promise<void>;
    /**
     * When a queue re-render happens
     * @param queue queue that just requested a render
     * @param display the QueueDisplayV2 object that handles the rendering
     * @remark Extensions with custom embeds should override this method to get the display object
     */
    onQueueRender: (
        queue: Readonly<HelpQueueV2>,
        display: Readonly<QueueDisplayV2>
    ) => Promise<void>;
    /**
     * Called every hour
     * @param queue queue that triggered the call
     * @param isFirstCall whether this is called inside HelpQueueV2.create
     * @deprecated will likely be removed in the future, extensions should manage their own timers
     */
    onQueuePeriodicUpdate: (
        queue: Readonly<HelpQueueV2>,
        isFirstCall: boolean
    ) => Promise<void>;
    /**
     * When a queue is deleted with `/queue remove` or YABOB getting kicked from a server
     * @param deletedQueue the queue that just got deleted
     * @remark Extensions should override this method to do any necessary clean up
     */
    onQueueDelete: (deletedQueue: Readonly<HelpQueueV2>) => Promise<void>;
}

/**
 * Boilerplate base class of interaction related extensions.
 * ----
 * - Any INTERACTION extension must inherit from here
 * - Always override postExternalSlashCommands() if you want to post your own commands
 * - override processCommand and/or processButton depending on which type you want
 */
class BaseInteractionExtension implements IInteractionExtension {
    get slashCommandData(): CommandData {
        return [];
    }
    canHandleButton(interaction: ButtonInteraction): boolean {
        return false;
    }
    canHandleCommand(interaction: ChatInputCommandInteraction): boolean {
        return false;
    }
    canHandleModalSubmit(interaction: ModalSubmitInteraction): boolean {
        return false;
    }
    processCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
    processButton(interaction: ButtonInteraction): Promise<void> {
        return Promise.resolve();
    }
    processModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
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
        isFirstCall: boolean
    ): Promise<void> {
        return Promise.resolve();
    }
    onStudentJoinVC(
        server: Readonly<AttendingServerV2>,
        studentMember: GuildMember,
        voiceChannel: VoiceChannel
    ): Promise<void> {
        return Promise.resolve();
    }
    onStudentLeaveVC(
        server: Readonly<AttendingServerV2>,
        studentMember: GuildMember
    ): Promise<void> {
        return Promise.resolve();
    }
    onServerDelete(server: Readonly<AttendingServerV2>): Promise<void> {
        return Promise.resolve();
    }
    loadExternalServerData(serverId: string): Promise<Optional<ServerBackup>> {
        return Promise.resolve(undefined);
    }
    onServerRequestBackup(server: Readonly<AttendingServerV2>): Promise<void> {
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
    onQueueRender(
        queue: Readonly<HelpQueueV2>,
        display: Readonly<QueueDisplayV2>
    ): Promise<void> {
        return Promise.resolve();
    }
    onQueuePeriodicUpdate(
        queue: Readonly<HelpQueueV2>,
        isFirstCall: boolean
    ): Promise<void> {
        return Promise.resolve();
    }
    onQueueClose(queue: Readonly<HelpQueueV2>): Promise<void> {
        return Promise.resolve();
    }
    onQueueOpen(queue: Readonly<HelpQueueV2>): Promise<void> {
        return Promise.resolve();
    }
    onEnqueue(queue: Readonly<HelpQueueV2>, student: Readonly<Helpee>): Promise<void> {
        return Promise.resolve();
    }
    onDequeue(queue: Readonly<HelpQueueV2>, student: Readonly<Helpee>): Promise<void> {
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
    onQueueDelete(deletedQueue: Readonly<HelpQueueV2>): Promise<void> {
        return Promise.resolve();
    }
}

export {
    IInteractionExtension,
    IServerExtension,
    IQueueExtension,
    BaseInteractionExtension,
    BaseServerExtension,
    BaseQueueExtension
};
