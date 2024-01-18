/**
 * !! Important !!
 * All extensions will be called with Promise.all()
 * this means that extensions will be launched together
 * To avoid race conditions, do not let extensions modify shared data values
 * @module ExtensionInterface
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { GuildMember, TextChannel, VoiceChannel } from 'discord.js';
import { HelpQueue } from '../help-queue/help-queue.js';
import { Helpee, Helper } from '../models/member-states.js';
import { ServerBackup } from '../models/backups.js';
import {
    HelpMessage,
    Optional,
    QuickStartPageFunctions,
    SettingsMenuOption
} from '../utils/type-aliases.js';
import { FrozenDisplay, FrozenQueue, FrozenServer } from './extension-utils.js';
import {
    ButtonHandlerProps,
    CommandHandlerProps,
    ModalSubmitHandlerProps,
    SelectMenuHandlerProps
} from '../interaction-handling/handler-interface.js';
import { CommandData } from '../utils/type-aliases.js';
import { QueueChannel } from '../models/queue-channel.js';

interface InteractionExtension {
    /**
     * Do an initialization check at YABOB instance level
     * - Called inside client.on('ready')
     * - Errors thrown here will NOT be caught
     */
    initializationCheck(): Promise<void>;
    /**
     * The command data json to post to the discord server
     */
    slashCommandData: CommandData;
    /**
     * Help messages to be combined with base yabob help messages
     */
    helpMessages: {
        botAdmin: readonly HelpMessage[];
        staff: readonly HelpMessage[];
        student: readonly HelpMessage[];
    };
    /**
     * These options appear in the select menu of the main menu of /settings
     */
    settingsMainMenuOptions: readonly SettingsMenuOption[];
    /**
     * The list of quick start pages to inject for this extension
     */
    quickStartPages: readonly QuickStartPageFunctions[];
    /**
     * Command method map
     */
    commandMap: CommandHandlerProps;
    /**
     * Button method map
     */
    buttonMap: ButtonHandlerProps;
    /**
     * Select menu method map
     */
    selectMenuMap: SelectMenuHandlerProps;
    /**
     * Modal submit method map
     */
    modalMap: ModalSubmitHandlerProps;
}

/** Server Level Extension */
interface ServerExtension {
    /**
     * When a server instance is successfully created
     * @param server the newly created server
     */
    onServerInitSuccess: (server: FrozenServer) => Promise<void>;
    /**
     * When all the queues are successfully created.
     * Happens before {@link onServerInitSuccess}
     * @param server the newly created server
     * @param allQueues all the newly created queues
     */
    onAllQueuesInit: (
        server: FrozenServer,
        allQueues: ReadonlyArray<HelpQueue>
    ) => Promise<void>;
    /**
     * When a student is dequeued
     * @param server which server is this student from
     * @param dequeuedStudent the newly dequeued student
     */
    onDequeueFirst: (
        server: FrozenServer,
        dequeuedStudent: Readonly<Helpee>
    ) => Promise<void>;
    /**
     * When a helper starts helping. Called after `/start`
     * @param server which server is this helper from
     * @param helper the helper that used `start`
     */
    onHelperStartHelping: (
        server: FrozenServer,
        helper: Readonly<Omit<Helper, 'helpEnd'>>
    ) => Promise<void>;
    /**
     * When a helper stops helping. Called after `/stop`
     * @param server which server is this helper from
     * @param helper the helper that used `stop`
     */
    onHelperStopHelping: (
        server: FrozenServer,
        helper: Readonly<Required<Helper>>
    ) => Promise<void>;
    /**
     * Called every 15 minutes
     * @param server the object
     * @param isFirstCall whether this is called inside server init
     * @deprecated will likely be removed in the future
     */
    onServerPeriodicUpdate: (server: FrozenServer, isFirstCall: boolean) => Promise<void>;
    /**
     * When a student that just dequeued joins the voice channel
     * @param server which server is this student from
     * @param studentMember the student guild member object
     * @param voiceChannel non-null voice channel
     */
    onStudentJoinVC: (
        server: FrozenServer,
        studentMember: GuildMember,
        voiceChannel: VoiceChannel
    ) => Promise<void>;
    /**
     * When a student finishes receiving help and leaves the voice channel
     * @param server which server is this student from
     * @param studentMember the student guild member object
     */
    onStudentLeaveVC: (server: FrozenServer, studentMember: GuildMember) => Promise<void>;
    /**
     * When YABOB is kicked from a server.
     * Extensions should override this method to do any necessary cleanup
     * @param server the server that just got deleted
     */
    onServerDelete: (server: FrozenServer) => Promise<void>;
    /**
     * When /set_time_zone is used
     */
    onTimeZoneChange: (server: FrozenServer) => Promise<void>;
    /**
     * When the server asks for external backup data. Called inside AttendingServerV2.create
     * @param serverId the guild id
     * @returns Optional backup. If no extension provides backups, start fresh
     */
    loadExternalServerData: (serverId: string) => Promise<Optional<ServerBackup>>;
    /**
     * When the server requests backups.
     * @param server the server to backup
     */
    onServerRequestBackup: (server: FrozenServer) => Promise<void>;
}

/** Extensions for individual queues */
interface QueueExtension {
    /**
     * When a single queue is created
     * @param queue the newly created queue
     */
    onQueueCreate: (queue: FrozenQueue) => Promise<void>;
    /**
     * When a queue opens
     * @param queue the newly opened queue
     */
    onQueueOpen: (queue: FrozenQueue) => Promise<void>;
    /**
     * When a queue closes
     * @param queue the newly closed queue
     */
    onQueueClose: (queue: FrozenQueue) => Promise<void>;
    /**
     * When a student joins the queue
     * @param queue the queue that the students joined
     * @param student the student that just joined
     */
    onEnqueue: (queue: FrozenQueue, student: Readonly<Helpee>) => Promise<void>;
    /**
     * When a student is dequeued by a helper using `/next`
     * @param queue the queue that the students just left
     * @param student the newly dequeued student
     */
    onDequeue: (queue: FrozenQueue, student: Readonly<Helpee>) => Promise<void>;
    /**
     * When a student leaves the queue with `/leave` or [LEAVE]
     * @param queue the queue that the students just left
     * @param student the newly left student
     */
    onStudentRemove: (queue: FrozenQueue, student: Readonly<Helpee>) => Promise<void>;
    /**
     * When `clear` is used
     * @param queue queue after clearing everyone
     * @param students the students that just got cleared
     */
    onRemoveAllStudents: (
        queue: FrozenQueue,
        students: ReadonlyArray<Helpee>
    ) => Promise<void>;
    /**
     * When the category channel of this queue is changed (mostly name changes)
     * @param queue
     * @param oldQueueChannel
     * @param newQueueChannel
     * @returns
     */
    onQueueChannelUpdate: (
        queue: FrozenQueue,
        oldQueueChannel: QueueChannel,
        newQueueChannel: QueueChannel
    ) => Promise<void>;
    /**
     * When a queue re-render happens
     * @param queue queue that just requested a render
     * @param display the QueueDisplayV2 object that handles the rendering
     */
    onQueueRender: (queue: FrozenQueue, display: FrozenDisplay) => Promise<void>;
    /**
     * When a queue is deleted with `/queue remove` or YABOB getting kicked from a server
     * @param deletedQueue the queue that just got deleted
     * @remark Extensions should override this method to do any necessary clean up
     */
    onQueueDelete: (deletedQueue: FrozenQueue) => Promise<void>;
}

/**
 * Boilerplate base class of interaction related extensions.
 * ----
 * - Any INTERACTION extension must inherit from here
 * - Provide method maps by overriding commandMap, buttonMap, selectMenuMap, or modalMap
 * - Add help messages in the helpMessages array
 * - Add setting menu options in the settingsMainMenuOptions array
 */
abstract class BaseInteractionExtension implements InteractionExtension {
    initializationCheck(): Promise<void> {
        return Promise.resolve();
    }
    helpMessages: {
        botAdmin: ReadonlyArray<HelpMessage>;
        staff: ReadonlyArray<HelpMessage>;
        student: ReadonlyArray<HelpMessage>;
    } = {
        botAdmin: [],
        staff: [],
        student: []
    };
    settingsMainMenuOptions: ReadonlyArray<SettingsMenuOption> = [];
    slashCommandData: CommandData = [];
    quickStartPages: readonly QuickStartPageFunctions[] = [];
    commandMap: CommandHandlerProps = {
        methodMap: {},
        skipProgressMessageCommands: new Set()
    };
    buttonMap: ButtonHandlerProps = {
        guildMethodMap: {
            queue: {},
            other: {}
        },
        dmMethodMap: {},
        skipProgressMessageButtons: new Set()
    };
    selectMenuMap: SelectMenuHandlerProps = {
        guildMethodMap: {
            queue: {},
            other: {}
        },
        dmMethodMap: {},
        skipProgressMessageSelectMenus: new Set()
    };
    modalMap: ModalSubmitHandlerProps = {
        guildMethodMap: {
            queue: {},
            other: {}
        },
        dmMethodMap: {}
    };
}

/**
 * Boilerplate base class of server related extensions.
 * ----
 * - Any SERVER extension must inherit from here
 * - Override the events that you want to trigger
 */
abstract class BaseServerExtension implements ServerExtension {
    onServerInitSuccess(server: FrozenServer): Promise<void> {
        return Promise.resolve();
    }
    onAllQueuesInit(
        server: FrozenServer,
        allQueues: ReadonlyArray<HelpQueue>
    ): Promise<void> {
        return Promise.resolve();
    }
    onDequeueFirst(
        server: FrozenServer,
        dequeuedStudent: Readonly<Helpee>
    ): Promise<void> {
        return Promise.resolve();
    }
    onHelperStartHelping(
        server: FrozenServer,
        helper: Readonly<Omit<Helper, 'helpEnd'>>
    ): Promise<void> {
        return Promise.resolve();
    }
    onHelperStopHelping(
        server: FrozenServer,
        helper: Readonly<Required<Helper>>
    ): Promise<void> {
        return Promise.resolve();
    }
    onServerPeriodicUpdate(server: FrozenServer, isFirstCall: boolean): Promise<void> {
        return Promise.resolve();
    }
    onStudentJoinVC(
        server: FrozenServer,
        studentMember: GuildMember,
        voiceChannel: VoiceChannel
    ): Promise<void> {
        return Promise.resolve();
    }
    onStudentLeaveVC(server: FrozenServer, studentMember: GuildMember): Promise<void> {
        return Promise.resolve();
    }
    onServerDelete(server: FrozenServer): Promise<void> {
        return Promise.resolve();
    }
    onTimeZoneChange(server: FrozenServer): Promise<void> {
        return Promise.resolve();
    }
    loadExternalServerData(serverId: string): Promise<Optional<ServerBackup>> {
        return Promise.resolve(undefined);
    }
    onServerRequestBackup(server: FrozenServer): Promise<void> {
        return Promise.resolve();
    }
}

/**
 * Boilerplate base class of individual-queue related extensions.
 * ----
 * - Any QUEUE extension must inherit from here
 * - Override the events that you want to trigger
 */
abstract class BaseQueueExtension implements QueueExtension {
    onQueueCreate(queue: FrozenQueue): Promise<void> {
        return Promise.resolve();
    }
    onQueueRender(queue: FrozenQueue, display: FrozenDisplay): Promise<void> {
        return Promise.resolve();
    }
    onQueueClose(queue: FrozenQueue): Promise<void> {
        return Promise.resolve();
    }
    onQueueOpen(queue: FrozenQueue): Promise<void> {
        return Promise.resolve();
    }
    onEnqueue(queue: FrozenQueue, student: Readonly<Helpee>): Promise<void> {
        return Promise.resolve();
    }
    onDequeue(queue: FrozenQueue, student: Readonly<Helpee>): Promise<void> {
        return Promise.resolve();
    }
    onStudentRemove(queue: FrozenQueue, student: Readonly<Helpee>): Promise<void> {
        return Promise.resolve();
    }
    onRemoveAllStudents(
        queue: FrozenQueue,
        students: ReadonlyArray<Helpee>
    ): Promise<void> {
        return Promise.resolve();
    }
    onQueueChannelUpdate(
        queue: FrozenQueue,
        oldQueueChannel: QueueChannel,
        newQueueChannel: QueueChannel
    ): Promise<void> {
        return Promise.resolve();
    }
    onQueueDelete(deletedQueue: FrozenQueue): Promise<void> {
        return Promise.resolve();
    }
}

export {
    InteractionExtension,
    ServerExtension,
    QueueExtension,
    BaseInteractionExtension,
    BaseServerExtension,
    BaseQueueExtension
};
