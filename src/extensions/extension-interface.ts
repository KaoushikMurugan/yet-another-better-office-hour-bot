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
    ModalSubmitInteraction,
    SelectMenuInteraction,
    Guild,
    RESTPostAPIApplicationCommandsJSONBody
} from 'discord.js';
import { HelpQueueV2 } from '../help-queue/help-queue.js';
import { Helpee, Helper } from '../models/member-states.js';
import { ServerBackup } from '../models/backups.js';
import { CommandData } from '../command-handling/command/slash-commands.js';
import { HelpMessage, Optional, SettingsMenuOption } from '../utils/type-aliases.js';
import { FrozenDisplay, FrozenQueue, FrozenServer } from './extension-utils.js';
import {
    ButtonHandlerProps,
    CommandHandlerProps,
    ModalSubmitHandlerProps,
    SelectMenuHandlerProps
} from '../interaction-handling/handler-interface.js';

/** YABOB Instance Level Extension */
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
     * Whether the extension can handle DM buttons
     * @param interaction
     */
    canHandleDMButton: (interaction: ButtonInteraction) => boolean;
    /**
     * Whether the extension can handle modal submit
     * @param interaction
     */
    canHandleModalSubmit: (interaction: ModalSubmitInteraction<'cached'>) => boolean;
    /**
     * Whether the extension can hendle DM modal submit
     * @param interaction
     */
    canHandleDMModalSubmit: (interaction: ModalSubmitInteraction) => boolean;
    /**
     * Whether the extension can handle select menus
     * @param interaction
     */
    canHandleSelectMenu: (interaction: SelectMenuInteraction<'cached'>) => boolean;
    /**
     * Whether the extension can handle DM select menus
     * @param interaction
     */
    canHandleDMSelectMenu: (interaction: SelectMenuInteraction) => boolean;
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
     * Interface to the DM button processor. If the extension can handle this button,
     * it should reply inside this method
     * @param interaction
     */
    processDMButton: (interaction: ButtonInteraction) => Promise<void>;
    /**
     * Interface to the modal submit processor. If the extension can handle this button,
     * it should reply inside this method
     * @param interaction the modal that's guaranteed to be handled by this extension
     */
    processModalSubmit: (interaction: ModalSubmitInteraction<'cached'>) => Promise<void>;
    /**
     * Interface to the DM modal submit processor. If the extension can handle this button,
     * it should reply inside this method
     * @param interaction the modal that's guaranteed to be handled by this extension
     */
    processDMModalSubmit: (interaction: ModalSubmitInteraction) => Promise<void>;
    /**
     * Interface to the select menu processor. If the extension can handle this button,
     * @param interaction the select menu that's guaranteed to be handled by this extension
     */
    processSelectMenu: (interaction: SelectMenuInteraction<'cached'>) => Promise<void>;
    /**
     * Interface to the DM select menu processor. If the extension can handle this button,
     * @param interaction the select menu that's guaranteed to be handled by this extension
     */
    processDMSelectMenu: (interaction: SelectMenuInteraction) => Promise<void>;
}

interface IInteractionExtension2 {
    /**
     * Create a state for each guild if necessary
     * @param guild which guild to create state for
     */
    loadState(guild: Guild): Promise<void>;
    /**
     * The command data json to post to the discord server
     */
    slashCommandData: CommandData;
    /**
     * Help messages to be combined with base yabob help messages
     */
    helpMessages: {
        botAdmin: ReadonlyArray<HelpMessage>;
        staff: ReadonlyArray<HelpMessage>;
        student: ReadonlyArray<HelpMessage>;
    };
    /**
     *
     */
    settingsMainMenuOptions: ReadonlyArray<SettingsMenuOption>;
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
interface IServerExtension {
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
        allQueues: ReadonlyArray<HelpQueueV2>
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
    onServerRequestBackup: (server: FrozenServer) => Promise<void>;
}

/** Extensions for individual queues */
interface IQueueExtension {
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
     * When a queue re-render happens
     * @param queue queue that just requested a render
     * @param display the QueueDisplayV2 object that handles the rendering
     * @remark Extensions with custom embeds should override this method to get the display object
     */
    onQueueRender: (queue: FrozenQueue, display: FrozenDisplay) => Promise<void>;
    /**
     * Called every hour
     * @param queue queue that triggered the call
     * @param isFirstCall whether this is called inside HelpQueueV2.create
     * @deprecated will likely be removed in the future, extensions should manage their own timers
     */
    onQueuePeriodicUpdate: (queue: FrozenQueue, isFirstCall: boolean) => Promise<void>;
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
    canHandleDMButton(interactoin: ButtonInteraction): boolean {
        return false;
    }
    canHandleCommand(interaction: ChatInputCommandInteraction): boolean {
        return false;
    }
    canHandleModalSubmit(interaction: ModalSubmitInteraction): boolean {
        return false;
    }
    canHandleDMModalSubmit(interaction: ModalSubmitInteraction): boolean {
        return false;
    }
    canHandleSelectMenu(interaction: SelectMenuInteraction): boolean {
        return false;
    }
    canHandleDMSelectMenu(interaction: SelectMenuInteraction): boolean {
        return false;
    }
    processCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        return Promise.resolve();
    }
    processButton(interaction: ButtonInteraction): Promise<void> {
        return Promise.resolve();
    }
    processDMButton(interaction: ButtonInteraction): Promise<void> {
        return Promise.resolve();
    }
    processModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        return Promise.resolve();
    }
    processDMModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        return Promise.resolve();
    }
    processSelectMenu(interaction: SelectMenuInteraction): Promise<void> {
        return Promise.resolve();
    }
    processDMSelectMenu(interaction: SelectMenuInteraction): Promise<void> {
        return Promise.resolve();
    }
}

class BaseInteractionExtension2 implements IInteractionExtension2 {
    loadState(guild: Guild): Promise<void> {
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
    slashCommandData: RESTPostAPIApplicationCommandsJSONBody[] = [];
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
class BaseServerExtension implements IServerExtension {
    onServerInitSuccess(server: FrozenServer): Promise<void> {
        return Promise.resolve();
    }
    onAllQueuesInit(
        server: FrozenServer,
        allQueues: ReadonlyArray<HelpQueueV2>
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
class BaseQueueExtension implements IQueueExtension {
    onQueueCreate(queue: FrozenQueue): Promise<void> {
        return Promise.resolve();
    }
    onQueueRender(queue: FrozenQueue, display: FrozenDisplay): Promise<void> {
        return Promise.resolve();
    }
    onQueuePeriodicUpdate(queue: FrozenQueue, isFirstCall: boolean): Promise<void> {
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
    onQueueDelete(deletedQueue: FrozenQueue): Promise<void> {
        return Promise.resolve();
    }
}

export {
    IInteractionExtension,
    IInteractionExtension2,
    IServerExtension,
    IQueueExtension,
    BaseInteractionExtension,
    BaseInteractionExtension2,
    BaseServerExtension,
    BaseQueueExtension
};
