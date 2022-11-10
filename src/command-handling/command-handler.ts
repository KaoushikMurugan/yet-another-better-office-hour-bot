/** @module BuiltInHandlers */

/**
 * @packageDocumentation
 * Responsible for preprocessing commands and dispatching them to servers
 * ----
 * Each YABOB instance should only have 1 BuiltInCommandHandler
 * All the functions below follows this convention:
 * - async function <corresponding command name>(interaction): Promise<YabobEmbed>
 * @category Handler Classes
 * @param interaction the raw interaction
 * @throws CommandParseError: if command doesn't satify the checks in Promise.all
 * @throws QueueError or ServerError: if the target HelpQueueV2 or AttendingServer rejects
 */

import { BaseMessageOptions, ChatInputCommandInteraction } from 'discord.js';
import {
    EmbedColor,
    SimpleEmbed,
    ErrorEmbed,
    SlashCommandLogEmbed,
    ErrorLogEmbed
} from '../utils/embed-helper.js';
import { CommandParseError } from '../utils/error-types.js';
import {
    hasValidQueueArgument,
    isServerInteraction,
    isTriggeredByMemberWithRoles
} from './common-validations.js';
import {
    convertMsToShortTime,
    isTextChannel,
    isValidCategoryName,
    isValidChannelName,
    logSlashCommand
} from '../utils/util-functions.js';
// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { CommandCallback, YabobEmbed } from '../utils/type-aliases.js';
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands.js';
import { afterSessionMessageModal, queueAutoClearModal } from './modal-objects.js';
import { ExpectedParseErrors } from './expected-interaction-errors.js';
import { SuccessMessages } from './builtin-success-messages.js';
import { serverSettingsMainMenu } from '../attending-server/server-config-messages.js';

/**
 * The map of available commands
 * Key is what the user will see, value is the arrow function
 * - undefined return values is when the method wants to reply to the interaction directly
 * - If a call returns undefined, processCommand won't edit the reply
 */
const commandMethodMap: { [commandName: string]: CommandCallback } = {
    announce: announce,
    cleanup_queue: cleanup,
    cleanup_all: cleanupAllQueues,
    cleanup_help_channels: cleanupHelpChannel,
    clear: clear,
    clear_all: clearAll,
    enqueue: enqueue,
    leave: leave,
    list_helpers: listHelpers,
    next: next,
    queue: queue,
    start: start,
    stop: stop,
    help: help,
    set_logging_channel: setLoggingChannel,
    stop_logging: stopLogging,
    serious_mode: setSeriousMode,
    create_offices: createOffices,
    set_roles: setRoles,
    settings: settingsMenu
} as const;

/**
 * Commands in this object only shows a modal on ChatInputCommandInteraction<'cached'>
 * Actual changes to attendingServers happens on modal submit
 * - @see modal-handler.ts
 */
const showModalOnlyCommands: {
    [commandName: string]: (
        inter: ChatInputCommandInteraction<'cached'>
    ) => Promise<void>;
} = {
    set_after_session_msg: showAfterSessionMessageModal,
    set_queue_auto_clear: showQueueAutoClearModal
} as const;

function builtInCommandHandlerCanHandle(
    interaction: ChatInputCommandInteraction<'cached'>
): boolean {
    return (
        interaction.commandName in commandMethodMap ||
        interaction.commandName in showModalOnlyCommands
    );
}

/**
 * Main processor for command interactions
 * @param interaction the raw interaction from discord js
 */
async function processBuiltInCommand(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    const commandMethod = commandMethodMap[interaction.commandName];
    logSlashCommand(interaction);
    if (interaction.commandName in showModalOnlyCommands) {
        await showModalOnlyCommands[interaction.commandName]?.(interaction);
        return;
    }
    // Immediately reply to show that YABOB has received the interaction
    // non modal commands only
    await interaction.reply({
        ...SimpleEmbed(
            `Processing command \`${interaction.commandName}\` ...`,
            EmbedColor.Neutral
        ),
        ephemeral: true
    });
    // this await keyword is necessary, do not remove even though we are also using callbacks
    // this modifies the closure to
    // alllow the failure inside catch block be caught at top level in app.ts
    await commandMethod?.(interaction)
        .then(async successMsg => {
            await Promise.all([
                interaction.editReply(successMsg),
                server.sendLogMessage(SlashCommandLogEmbed(interaction))
            ]);
        })
        .catch(async err => {
            // Central error handling, reply to user with the error
            await Promise.all([
                // if not replied (when using modals), reply
                interaction.replied
                    ? interaction.editReply(ErrorEmbed(err, server.botAdminRoleID))
                    : interaction.reply({
                          ...ErrorEmbed(err, server.botAdminRoleID),
                          ephemeral: true
                      }),
                server.sendLogMessage(ErrorLogEmbed(err, interaction))
            ]);
        });
}

/**
 * The `/queue add` and `/queue remove` command
 */
async function queue(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        `queue ${interaction.options.getSubcommand()}`,
        'Bot Admin'
    );
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
        case 'add': {
            const queueName = interaction.options.getString('queue_name', true);
            if (!isValidChannelName(queueName)) {
                throw ExpectedParseErrors.invalidChannelName;
            }
            await server.createQueue(queueName);
            return SuccessMessages.createdQueue(queueName);
        }
        case 'remove': {
            const targetQueue = hasValidQueueArgument(interaction, true);
            if (!interaction.channel || interaction.channel.isDMBased()) {
                throw ExpectedParseErrors.nonServerInterction();
            }
            if (interaction.channel.parentId === targetQueue.parentCategoryId) {
                throw ExpectedParseErrors.removeInsideQueue;
            }
            await server.deleteQueueById(targetQueue.parentCategoryId);
            return SuccessMessages.deletedQueue(targetQueue.queueName);
        }
        default: {
            throw new CommandParseError(`Invalid /queue subcommand ${subcommand}.`);
        }
    }
}

/**
 * The `/enqueue command`
 * @param interaction
 */
async function enqueue(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        hasValidQueueArgument(interaction)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, 'set_roles', 'Student');
    await server.enqueueStudent(interaction.member, queueChannel);
    return SuccessMessages.joinedQueue(queueChannel.queueName);
}

/**
 * The `/next` command, both with arguments or without arguments
 * @param interaction
 */
async function next(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    const helperMember = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'next',
        'Staff'
    );
    const targetQueue =
        interaction.options.getChannel('queue_name', false) === null
            ? undefined
            : hasValidQueueArgument(interaction, true);
    const targetStudent = interaction.options.getMember('user') ?? undefined;
    // if either target queue or target student is specified, use dequeueWithArgs
    // otherwise use dequeueGlobalFirst
    const dequeuedStudent =
        targetQueue || targetStudent
            ? await server.dequeueWithArgs(helperMember, targetStudent, targetQueue)
            : await server.dequeueGlobalFirst(helperMember);
    return SuccessMessages.inviteSent(dequeuedStudent.member.displayName);
}

/**
 * The `/start` command
 * @param interaction
 */
async function start(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'start',
        'Staff'
    );
    const muteNotif = interaction.options.getBoolean('mute_notif') ?? false;
    await server.openAllOpenableQueues(member, !muteNotif);
    return SuccessMessages.startedHelping;
}

/**
 * The `/stop` command
 * @param interaction
 */
async function stop(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'stop',
        'Staff'
    );
    const helpTimeEntry = await server.closeAllClosableQueues(member);
    return SuccessMessages.finishedHelping(helpTimeEntry);
}

/**
 * The `/leave queue` command
 * @param interaction
 */
async function leave(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, queue] = [
        isServerInteraction(interaction),
        hasValidQueueArgument(interaction)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, 'set_roles', 'Student');
    await server.removeStudentFromQueue(interaction.member, queue);
    return SuccessMessages.leftQueue(queue.queueName);
}

/**
 * The `/clear queueName` command
 * @param interaction
 */
async function clear(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, queue] = [
        isServerInteraction(interaction),
        hasValidQueueArgument(interaction, true)
    ];
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'clear',
        'Staff'
    );
    // if they are not admin or doesn't have the queue role, reject
    if (
        !member.roles.cache.some(
            role => role.name === queue.queueName || role.id === server.botAdminRoleID
        )
    ) {
        throw ExpectedParseErrors.noPermission.clear(queue.queueName);
    }
    await server.clearQueue(queue);
    return SuccessMessages.clearedQueue(queue.queueName);
}

/**
 * The `/clear_all` command
 * @param interaction
 */
async function clearAll(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(server, interaction.member, 'clear_all', 'Bot Admin');
    const allQueues = await server.getQueueChannels();
    if (allQueues.length === 0) {
        throw ExpectedParseErrors.serverHasNoQueue;
    }
    await server.clearAllQueues();
    return SuccessMessages.clearedAllQueues(server.guild.name);
}

/**
 * The `/list_helpers` command
 * @param interaction
 */
async function listHelpers(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<BaseMessageOptions> {
    const server = isServerInteraction(interaction);
    const helpers = server.activeHelpers;
    if (helpers === undefined || helpers.size === 0) {
        return SimpleEmbed('No one is currently helping.');
    }
    const allQueues = await server.getQueueChannels();
    const table = new AsciiTable3()
        .setHeading(
            'Tutor name',
            'Availbale Queues',
            'Time Elapsed (hh:mm:ss)',
            'VC Status'
        )
        .setAlign(1, AlignmentEnum.CENTER)
        .setAlign(2, AlignmentEnum.CENTER)
        .setAlign(3, AlignmentEnum.CENTER)
        .setAlign(4, AlignmentEnum.CENTER)
        .setStyle('unicode-mix')
        .addRowMatrix(
            [...helpers.values()].map(helper => [
                helper.member.displayName, // Tutor Name
                helper.member.roles.cache
                    .filter(
                        role =>
                            allQueues.find(queue => queue.queueName === role.name) !==
                            undefined
                    )
                    .map(role => role.name)
                    .toString(), // Available Queues
                convertMsToShortTime(new Date().getTime() - helper.helpStart.getTime()), // Time Elapsed
                (() => {
                    const voiceChannel = interaction.guild.voiceStates.cache.get(
                        helper.member.id
                    )?.channel;
                    if (!voiceChannel) {
                        return 'Not in voice channel';
                    }
                    return voiceChannel.members.size > 1
                        ? `Busy in [${voiceChannel.name}]`
                        : `Idling in [${voiceChannel.name}]`;
                })() // Status, IIFE to cram in more logic
            ])
        )
        .setWidths([10, 10, 10, 10])
        .setWrapped(1)
        .setWrapped(2)
        .setWrapped(3)
        .setWrapped(4);
    return SimpleEmbed(
        'Current Helpers',
        EmbedColor.Aqua,
        '```' + table.toString() + '```'
    );
}

/**
 * The `/announce` command
 * @param interaction
 */
async function announce(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'announce',
        'Staff'
    );
    const announcement = interaction.options.getString('message', true);
    if (announcement.length >= 4096) {
        throw ExpectedParseErrors.messageIsTooLong;
    }
    const optionalChannel = interaction.options.getChannel('queue_name', false);
    if (optionalChannel !== null) {
        const queueChannel = hasValidQueueArgument(interaction, true);
        await server.announceToStudentsInQueue(member, announcement, queueChannel);
    } else {
        await server.announceToStudentsInQueue(member, announcement);
    }
    return SuccessMessages.announced(announcement);
}

/**
 * Then `/clean_up` command
 * @param interaction
 */
async function cleanup(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, queue] = [
        isServerInteraction(interaction),
        hasValidQueueArgument(interaction, true)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, 'cleanup', 'Bot Admin');
    await server.cleanUpQueue(queue);
    return SuccessMessages.cleanedup.queue(queue.queueName);
}

/**
 * The `/cleanup_all` command
 * @param interaction
 */
async function cleanupAllQueues(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(server, interaction.member, 'cleanup', 'Bot Admin');
    const allQueues = await server.getQueueChannels();
    await Promise.all(allQueues.map(queueChannel => server.cleanUpQueue(queueChannel)));
    return SuccessMessages.cleanedup.allQueues;
}

/**
 * The `/cleanup_help_channel` command
 * @param interaction
 */
async function cleanupHelpChannel(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'cleanup_help_channel',
        'Bot Admin'
    );
    await server.updateCommandHelpChannels();
    return SuccessMessages.cleanedup.helpChannels;
}

/**
 * The `/set_after_session_msg` command
 * @param interaction
 */
async function showAfterSessionMessageModal(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'set_after_session_msg',
        'Bot Admin'
    );
    await interaction.showModal(afterSessionMessageModal(server.guild.id));
}

/**
 * The `/help` command
 * @param interaction
 */
async function help(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<BaseMessageOptions> {
    const commandName = interaction.options.getString('command', true);
    const helpMessage =
        adminCommandHelpMessages.find(
            message => message.nameValuePair.name === commandName
        ) ??
        helperCommandHelpMessages.find(
            message => message.nameValuePair.name === commandName
        ) ??
        studentCommandHelpMessages.find(
            message => message.nameValuePair.name === commandName
        );
    if (helpMessage !== undefined) {
        return interaction.editReply(helpMessage.message);
    } else {
        throw new CommandParseError('Command not found.');
    }
}

/**
 * The `/set_logging_channel` command
 * @param interaction
 */
async function setLoggingChannel(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'set_logging_channel',
        'Bot Admin'
    );
    const loggingChannel = interaction.options.getChannel('channel', true);
    if (!isTextChannel(loggingChannel)) {
        throw new CommandParseError(`${loggingChannel.name} is not a text channel.`);
    }
    await server.setLoggingChannel(loggingChannel);
    return SuccessMessages.updatedLoggingChannel(loggingChannel.name);
}

/**
 * The `/set_queue_auto_clear` command
 * @param interaction
 */
async function showQueueAutoClearModal(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'set_queue_auto_clear',
        'Bot Admin'
    );
    await interaction.showModal(queueAutoClearModal(server.guild.id));
}

/**
 * The `/stop_logging` command
 * @param interaction
 */
async function stopLogging(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(server, interaction.member, 'stop_logging', 'Bot Admin');
    await server.setLoggingChannel(undefined);
    return SuccessMessages.stoppedLogging;
}

/**
 * The `/serious_mode` command
 * @param interaction
 */
async function setSeriousMode(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'activate_serious_mode',
        'Bot Admin'
    );
    const onOrOff = interaction.options.getSubcommand();
    if (onOrOff === 'on') {
        await server.setSeriousServer(true);
        return SuccessMessages.turnedOnSeriousMode;
    } else {
        await server.setSeriousServer(false);
        return SuccessMessages.turnedOffSeriousMode;
    }
}

/**
 * The `/create_offices` command
 * @param interaction
 * @returns
 */
async function createOffices(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'create_offices',
        'Bot Admin'
    );
    const categoryName = interaction.options.getString('category_name', true);
    const officeName = interaction.options.getString('office_name', true);
    const numOffices = interaction.options.getInteger('number_of_offices', true);
    if (!isValidCategoryName(categoryName)) {
        throw ExpectedParseErrors.invalidCategoryName(categoryName);
    } else if (!isValidChannelName(officeName)) {
        throw ExpectedParseErrors.invalidChannelName(officeName);
    }
    await server.createOffices(categoryName, officeName, numOffices);
    return SuccessMessages.createdOffices(numOffices);
}

/**
 * The `/set_roles` command
 * @param interaction
 * @returns
 */
async function setRoles(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(server, interaction.member, 'set_roles', 'Bot Admin');
    const roleType = interaction.options.getString('role_name', true);
    const role = interaction.options.getRole('role', true);
    if (roleType === 'bot_admin') {
        await server.setBotAdminRoleID(role.id);
        return SuccessMessages.setBotAdminRole(role.id);
    } else if (roleType === 'helper') {
        await server.setHelperRoleID(role.id);
        return SuccessMessages.setHelperRole(role.id);
    } else if (roleType === 'student') {
        await server.setStudentRoleID(role.id);
        return SuccessMessages.setStudentRole(role.id);
    } else {
        throw new CommandParseError('Invalid role type.');
    }
}

/**
 * The `/settings` command
 *
 * Only prompts the "menu". The button presses are handled by button-handlers.ts
 * @param interaction
 * @returns
 */
async function settingsMenu(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'setup_server_config',
        'Bot Admin'
    );

    return serverSettingsMainMenu(server, interaction.channelId, false);
}

/**
 * Only export the handler and the 'canHandle' check
 */
export { processBuiltInCommand, builtInCommandHandlerCanHandle };
