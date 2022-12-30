import { SimpleEmbed, EmbedColor } from '../utils/embed-helper.js';
import { CommandParseError } from '../utils/error-types.js';
import {
    convertMsToShortTime,
    isTextChannel,
    isValidCategoryName,
    isValidChannelName
} from '../utils/util-functions.js';
import { CommandHandlerProps } from './handler-interface.js';
// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { CommandNames } from './interaction-constants/interaction-names.js';
import { ChatInputCommandInteraction } from 'discord.js';
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands.js';
import {
    updateCommandHelpChannels,
    createOfficeVoiceChannels
} from '../attending-server/guild-actions.js';
import { SettingsMainMenu } from '../attending-server/server-settings-menus.js';
import { ExpectedParseErrors } from './interaction-constants/expected-interaction-errors.js';
import {
    afterSessionMessageModal,
    queueAutoClearModal
} from './interaction-constants/modal-objects.js';
import { SuccessMessages } from './interaction-constants/success-messages.js';
import {
    isServerInteraction,
    hasValidQueueArgument,
    isTriggeredByMemberWithRoles
} from './shared-validations.js';

const baseYabobCommandMap: CommandHandlerProps = {
    methodMap: {
        [CommandNames.enqueue]: enqueue,
        [CommandNames.next]: next,
        [CommandNames.start]: start,
        [CommandNames.stop]: stop,
        [CommandNames.pause]: pause,
        [CommandNames.resume]: resume,
        [CommandNames.leave]: leave,
        [CommandNames.clear]: clear,
        [CommandNames.clear_all]: clearAll,
        [CommandNames.list_helpers]: listHelpers,
        [CommandNames.announce]: announce,
        [CommandNames.cleanup_queue]: cleanup,
        [CommandNames.cleanup_all]: cleanupAllQueues,
        [CommandNames.cleanup_help_channels]: cleanupHelpChannel,
        [CommandNames.help]: help,
        [CommandNames.set_logging_channel]: setLoggingChannel,
        [CommandNames.set_queue_auto_clear]: showQueueAutoClearModal,
        [CommandNames.stop_logging]: stopLogging,
        [CommandNames.serious_mode]: setSeriousMode,
        [CommandNames.create_offices]: createOffices,
        [CommandNames.set_roles]: setRoles,
        [CommandNames.settings]: settingsMenu,
        [CommandNames.auto_give_student_role]: setAutoGiveStudentRole,
        [CommandNames.set_after_session_msg]: showAfterSessionMessageModal
    },
    skipProgressMessageCommands: new Set([
        CommandNames.set_after_session_msg,
        CommandNames.set_queue_auto_clear
    ])
};

/**
 * The `/enqueue command`
 * @param interaction
 */
async function enqueue(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        hasValidQueueArgument(interaction)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, 'set_roles', 'student');
    await server.enqueueStudent(interaction.member, queueChannel);
    await interaction.editReply(SuccessMessages.joinedQueue(queueChannel.queueName));
}

/**
 * The `/next` command, both with arguments or without arguments
 * @param interaction
 */
async function next(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = isServerInteraction(interaction);
    const helperMember = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'next',
        'staff'
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
    await interaction.editReply(
        SuccessMessages.inviteSent(dequeuedStudent.member.displayName)
    );
}

/**
 * The `/start` command
 * @param interaction
 */
async function start(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = isServerInteraction(interaction);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'start',
        'staff'
    );
    const muteNotif = interaction.options.getBoolean('mute_notif') ?? false;
    await server.openAllOpenableQueues(member, !muteNotif);
    await interaction.editReply(SuccessMessages.startedHelping);
}

/**
 * The `/stop` command
 * @param interaction
 */
async function stop(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = isServerInteraction(interaction);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'stop',
        'staff'
    );
    const helpTimeEntry = await server.closeAllClosableQueues(member);
    await interaction.editReply(SuccessMessages.finishedHelping(helpTimeEntry));
}

async function pause(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = isServerInteraction(interaction);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'pause',
        'staff'
    );
    const existOtherActiveHelpers = await server.pauseHelping(member);
    await interaction.editReply(SuccessMessages.pausedHelping(existOtherActiveHelpers));
}

async function resume(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = isServerInteraction(interaction);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'pause',
        'staff'
    );
    await server.resumeHelping(member);
    await interaction.editReply(SuccessMessages.resumedHelping);
}

/**
 * The `/leave queue` command
 * @param interaction
 */
async function leave(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const [server, queue] = [
        isServerInteraction(interaction),
        hasValidQueueArgument(interaction)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, 'set_roles', 'student');
    await server.removeStudentFromQueue(interaction.member, queue);
    await interaction.editReply(SuccessMessages.leftQueue(queue.queueName));
}

/**
 * The `/clear queueName` command
 * @param interaction
 */
async function clear(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const [server, queue] = [
        isServerInteraction(interaction),
        hasValidQueueArgument(interaction, true)
    ];
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'clear',
        'staff'
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
    await interaction.editReply(SuccessMessages.clearedQueue(queue.queueName));
}

/**
 * The `/clear_all` command
 * @param interaction
 */
async function clearAll(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(server, interaction.member, 'clear_all', 'botAdmin');
    const allQueues = await server.getQueueChannels();
    if (allQueues.length === 0) {
        throw ExpectedParseErrors.serverHasNoQueue;
    }
    await server.clearAllQueues();
    await interaction.editReply(SuccessMessages.clearedAllQueues(server.guild.name));
}

/**
 * The `/list_helpers` command
 * @param interaction
 */
async function listHelpers(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    const helpers = server.helpers;
    if (helpers.size === 0) {
        SimpleEmbed('No one is currently helping.');
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
                `${helper.member.displayName} ${
                    helper.activeState === 'paused' ? '(paused)' : ''
                }`, // Tutor Name
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
    await interaction.editReply(
        SimpleEmbed('Current Helpers', EmbedColor.Aqua, '```' + table.toString() + '```')
    );
}

/**
 * The `/announce` command
 * @param interaction
 */
async function announce(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'announce',
        'staff'
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
    await interaction.editReply(SuccessMessages.announced(announcement));
}

/**
 * Then `/clean_up` command
 * @param interaction
 */
async function cleanup(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const [server, queue] = [
        isServerInteraction(interaction),
        hasValidQueueArgument(interaction, true)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, 'cleanup', 'botAdmin');
    await server.cleanUpQueue(queue);
    await interaction.editReply(SuccessMessages.cleanedup.queue(queue.queueName));
}

/**
 * The `/cleanup_all` command
 * @param interaction
 */
async function cleanupAllQueues(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(server, interaction.member, 'cleanup', 'botAdmin');
    const allQueues = await server.getQueueChannels();
    await Promise.all(allQueues.map(queueChannel => server.cleanUpQueue(queueChannel)));
    await interaction.editReply(SuccessMessages.cleanedup.allQueues);
}

/**
 * The `/cleanup_help_channel` command
 * @param interaction
 */
async function cleanupHelpChannel(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'cleanup_help_channel',
        'botAdmin'
    );
    await updateCommandHelpChannels(server.guild);
    await interaction.editReply(SuccessMessages.cleanedup.helpChannels);
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
        'botAdmin'
    );
    await interaction.showModal(afterSessionMessageModal(server.guild.id));
}

/**
 * The `/help` command
 * @param interaction
 */
async function help(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
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
        await interaction.editReply(helpMessage.message);
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
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'set_logging_channel',
        'botAdmin'
    );
    const loggingChannel = interaction.options.getChannel('channel', true);
    if (!isTextChannel(loggingChannel)) {
        throw new CommandParseError(`${loggingChannel.name} is not a text channel.`);
    }
    await server.setLoggingChannel(loggingChannel);
    await interaction.editReply(
        SuccessMessages.updatedLoggingChannel(loggingChannel.name)
    );
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
        'botAdmin'
    );
    await interaction.showModal(queueAutoClearModal(server.guild.id));
}

/**
 * The `/stop_logging` command
 * @param interaction
 */
async function stopLogging(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(server, interaction.member, 'stop_logging', 'botAdmin');
    await server.setLoggingChannel(undefined);
    await interaction.editReply(SuccessMessages.stoppedLogging);
}

/**
 * The `/serious_mode` command
 * @param interaction
 */
async function setSeriousMode(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'activate_serious_mode',
        'botAdmin'
    );
    const onOrOff = interaction.options.getSubcommand();
    if (onOrOff === 'on') {
        await server.setSeriousServer(true);
        await interaction.editReply(SuccessMessages.turnedOnSeriousMode);
    } else {
        await server.setSeriousServer(false);
        await interaction.editReply(SuccessMessages.turnedOffSeriousMode);
    }
}

/**
 * The `/create_offices` command
 * @param interaction
 * @s
 */
async function createOffices(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'create_offices',
        'botAdmin'
    );
    const categoryName = interaction.options.getString('category_name', true);
    const officeName = interaction.options.getString('office_name', true);
    const numOffices = interaction.options.getInteger('number_of_offices', true);
    if (!isValidCategoryName(categoryName)) {
        throw ExpectedParseErrors.invalidCategoryName(categoryName);
    }
    if (!isValidChannelName(officeName)) {
        throw ExpectedParseErrors.invalidChannelName(officeName);
    }
    await createOfficeVoiceChannels(server.guild, categoryName, officeName, numOffices, [
        server.botAdminRoleID,
        server.staffRoleID
    ]);
    await interaction.editReply(SuccessMessages.createdOffices(numOffices));
}

/**
 * The `/set_roles` command
 * @param interaction
 * @s
 */
async function setRoles(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(server, interaction.member, 'set_roles', 'botAdmin');
    const roleType = interaction.options.getString('role_name', true);
    const role = interaction.options.getRole('role', true);
    switch (roleType) {
        case 'bot_admin': {
            await server.setHierarchyRoleId('botAdmin', role.id);
            await interaction.editReply(SuccessMessages.setBotAdminRole(role.id));
            break;
        }
        case 'helper': {
            await server.setHierarchyRoleId('staff', role.id);
            await interaction.editReply(SuccessMessages.setHelperRole(role.id));
            break;
        }
        case 'student': {
            await server.setHierarchyRoleId('student', role.id);
            await interaction.editReply(SuccessMessages.setStudentRole(role.id));
            break;
        }
        default: {
            throw new CommandParseError('Invalid role type.');
        }
    }
}

/**
 * The `/settings` command
 *
 * Only prompts the "menu". The button presses are handled by button-handlers.ts
 * @param interaction
 * @s
 */
async function settingsMenu(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'setup_server_config',
        'botAdmin'
    );
    await interaction.editReply(SettingsMainMenu(server, interaction.channelId, false));
}

/**
 * The `/auto_give_role` commandf
 * @param interaction
 * @s
 */
async function setAutoGiveStudentRole(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'set_auto_give_student_role',
        'botAdmin'
    );
    const onOrOff = interaction.options.getSubcommand();
    if (onOrOff === 'on') {
        await server.setAutoGiveStudentRole(true);
        await interaction.editReply(SuccessMessages.turnedOnAutoGiveStudentRole);
    } else {
        await server.setAutoGiveStudentRole(false);
        await interaction.editReply(SuccessMessages.turnedOffAutoGiveStudentRole);
    }
}

export { baseYabobCommandMap };
