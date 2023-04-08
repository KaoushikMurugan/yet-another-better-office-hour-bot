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
import {
    updateCommandHelpChannels,
    createOfficeVoiceChannels
} from '../attending-server/guild-actions.js';
import {
    SettingsMainMenu,
    serverSettingsMainMenuOptions
} from '../attending-server/server-settings-menus.js';
import { ExpectedParseErrors } from './interaction-constants/expected-interaction-errors.js';
import { PromptHelpTopicModal } from './interaction-constants/modal-objects.js';
import { SuccessMessages } from './interaction-constants/success-messages.js';
import {
    hasValidQueueArgument,
    isTriggeredByMemberWithRoles,
    channelsAreUnderLimit
} from './shared-validations.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { HelpMainMenuEmbed } from './shared-interaction-functions.js';
import { SimpleTimeZone } from '../utils/type-aliases.js';

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
        [CommandNames.queue]: queue,
        [CommandNames.clear_all]: clearAll,
        [CommandNames.list_helpers]: listHelpers,
        [CommandNames.announce]: announce,
        [CommandNames.cleanup_queue]: cleanup,
        [CommandNames.cleanup_all]: cleanupAllQueues,
        [CommandNames.cleanup_help_channels]: cleanupHelpChannel,
        [CommandNames.help]: help,
        [CommandNames.set_logging_channel]: setLoggingChannel,
        [CommandNames.stop_logging]: stopLogging,
        [CommandNames.create_offices]: createOffices,
        [CommandNames.set_roles]: setRoles,
        [CommandNames.settings]: settingsMenu,
        [CommandNames.queue_notify]: joinQueueNotify,
        [CommandNames.set_time_zone]: setTimeZone
    },
    skipProgressMessageCommands: new Set([CommandNames.enqueue])
};

/**
 * The `/enqueue` command
 */
async function enqueue(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const [server, queueChannel] = [
        AttendingServerV2.get(interaction.guildId),
        hasValidQueueArgument(interaction)
    ];
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.enqueue,
        'student'
    );
    if (!server.promptHelpTopic) {
        await interaction.reply({
            ...SimpleEmbed(`Processing command \`/enqueue\` ...`),
            ephemeral: true
        });
    }
    await server.getQueueById(queueChannel.parentCategoryId).enqueue(interaction.member);
    server.promptHelpTopic
        ? await interaction.showModal(PromptHelpTopicModal(server.guild.id))
        : await interaction.editReply(
              SuccessMessages.joinedQueue(queueChannel.queueName)
          );
}

/**
 * The `/next` command, both with arguments or without arguments
 */
async function next(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const helperMember = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.next,
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
            ? await server.dequeueWithArguments(helperMember, targetStudent, targetQueue)
            : await server.dequeueGlobalFirst(helperMember);
    const helpTopic = dequeuedStudent.helpTopic;
    console.log(helpTopic);
    if (!helpTopic) {
        await interaction.editReply(
            SuccessMessages.inviteSent(dequeuedStudent.member.displayName)
        );
    } else {
        await interaction.editReply(
            SuccessMessages.inviteSentAndShowHelpTopic(
                dequeuedStudent.member.displayName,
                helpTopic
            )
        );
    }
}

/**
 * The `/queue add` and `/queue remove` command
 * @param interaction
 * @returns success message
 */
async function queue(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(server, interaction.member, CommandNames.queue, 'staff');
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
        case 'add': {
            const queueName = interaction.options.getString('queue_name', true);
            if (!isValidCategoryName(queueName)) {
                throw ExpectedParseErrors.invalidCategoryName(queueName);
            }
            await channelsAreUnderLimit(interaction, 1, 2);
            await server.createQueue(queueName);
            await interaction.editReply(SuccessMessages.createdQueue(queueName));
            break;
        }
        case 'remove': {
            const targetQueue = hasValidQueueArgument(interaction, true);
            if (!interaction.channel || interaction.channel.isDMBased()) {
                throw ExpectedParseErrors.nonServerInteraction();
            }
            if (interaction.channel.parentId === targetQueue.parentCategoryId) {
                throw ExpectedParseErrors.removeInsideQueue;
            }
            await server.deleteQueueById(targetQueue.parentCategoryId);
            await interaction.editReply(
                SuccessMessages.deletedQueue(targetQueue.queueName)
            );
            break;
        }
    }
}

/**
 * The `/start` command
 */
async function start(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.start,
        'staff'
    );
    const muteNotif = interaction.options.getBoolean('mute_notif') ?? false;
    await server.openAllOpenableQueues(member, !muteNotif);
    await interaction.editReply(SuccessMessages.startedHelping);
}

/**
 * The `/stop` command
 */
async function stop(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.stop,
        'staff'
    );
    const helpTimeEntry = await server.closeAllClosableQueues(member);
    await interaction.editReply(SuccessMessages.finishedHelping(helpTimeEntry));
}

/**
 * The `/pause` command
 */
async function pause(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.pause,
        'staff'
    );
    const existOtherActiveHelpers = await server.pauseHelping(member);
    await interaction.editReply(SuccessMessages.pausedHelping(existOtherActiveHelpers));
}

/**
 * The `/resume` command
 */
async function resume(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.resume,
        'staff'
    );
    await server.resumeHelping(member);
    await interaction.editReply(SuccessMessages.resumedHelping);
}

/**
 * The `/leave queue` command
 */
async function leave(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const [server, queue] = [
        AttendingServerV2.get(interaction.guildId),
        hasValidQueueArgument(interaction)
    ];
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.leave,
        'student'
    );
    await server.getQueueById(queue.parentCategoryId).removeStudent(interaction.member);
    await interaction.editReply(SuccessMessages.leftQueue(queue.queueName));
}

/**
 * The `/clear queueName` command
 */
async function clear(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const [server, queue] = [
        AttendingServerV2.get(interaction.guildId),
        hasValidQueueArgument(interaction, true)
    ];
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.clear,
        'staff'
    );
    // if they are not admin or doesn't have the queue role, reject
    const hasPermission = member.roles.cache.some(
        role => role.name === queue.queueName || role.id === server.botAdminRoleID
    );
    if (!hasPermission) {
        throw ExpectedParseErrors.noPermission.clear(queue.queueName);
    }
    await server.clearQueueById(queue.parentCategoryId);
    await interaction.editReply(SuccessMessages.clearedQueue(queue.queueName));
}

/**
 * The `/clear_all` command
 */
async function clearAll(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.clear_all,
        'botAdmin'
    );
    const allQueues = await server.getQueueChannels();
    if (allQueues.length === 0) {
        throw ExpectedParseErrors.serverHasNoQueue;
    }
    await server.clearAllQueues();
    await interaction.editReply(SuccessMessages.clearedAllQueues(server.guild.name));
}

/**
 * The `/list_helpers` command
 */
async function listHelpers(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const helpers = server.helpers;
    if (helpers.size === 0) {
        await interaction.editReply(SimpleEmbed('No one is currently helping.'));
        return;
    }
    const allQueues = await server.getQueueChannels();
    const table = new AsciiTable3()
        .setHeading(
            'Tutor name',
            'Available Queues',
            'Time Elapsed (hh:mm:ss)',
            'VC Status'
        )
        .setAlign(1, AlignmentEnum.CENTER)
        .setAlign(2, AlignmentEnum.CENTER)
        .setAlign(3, AlignmentEnum.CENTER)
        .setAlign(4, AlignmentEnum.CENTER)
        .setStyle('unicode-mix')
        .addRowMatrix(
            // map each helper to a 4-tuple
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
 */
async function announce(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.announce,
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
 */
async function cleanup(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const [server, queue] = [
        AttendingServerV2.get(interaction.guildId),
        hasValidQueueArgument(interaction, true)
    ];
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.cleanup_queue,
        'botAdmin'
    );
    await server.getQueueById(queue.parentCategoryId).triggerForceRender();
    await interaction.editReply(SuccessMessages.cleanedUp.queue(queue.queueName));
}

/**
 * The `/cleanup_all` command
 */
async function cleanupAllQueues(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.cleanup_all,
        'botAdmin'
    );
    const allQueues = await server.getQueueChannels();
    await Promise.all(
        allQueues.map(queueChannel =>
            server.getQueueById(queueChannel.parentCategoryId).triggerForceRender()
        )
    );
    await interaction.editReply(SuccessMessages.cleanedUp.allQueues);
}

/**
 * The `/cleanup_help_channel` command
 */
async function cleanupHelpChannel(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.cleanup_help_channels,
        'botAdmin'
    );
    await updateCommandHelpChannels(server.guild, server.accessLevelRoleIds);
    await interaction.editReply(SuccessMessages.cleanedUp.helpChannels);
}

/**
 * The `/help` command
 */
async function help(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const accessLevel =
        (await server.getHighestAccessLevelRole(interaction.member)) ?? 'student';
    await interaction.editReply(HelpMainMenuEmbed(server, accessLevel));
}

/**
 * The `/set_logging_channel` command
 */
async function setLoggingChannel(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.set_logging_channel,
        'botAdmin'
    );
    const loggingChannel = interaction.options.getChannel('channel', true);
    if (!isTextChannel(loggingChannel)) {
        throw ExpectedParseErrors.notTextChannel(loggingChannel.name);
    }
    if (loggingChannel.name === 'queue') {
        throw ExpectedParseErrors.cannotUseQueueChannelForLogging;
    }
    await server.setLoggingChannel(loggingChannel);
    await interaction.editReply(
        SuccessMessages.updatedLoggingChannel(loggingChannel.name)
    );
}

/**
 * The `/stop_logging` command
 */
async function stopLogging(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.stop_logging,
        'botAdmin'
    );
    await server.setLoggingChannel(undefined);
    await interaction.editReply(SuccessMessages.stoppedLogging);
}

/**
 * The `/create_offices` command
 */
async function createOffices(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.create_offices,
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
    if (!interaction.guild.roles.cache.has(server.botAdminRoleID)) {
        throw ExpectedParseErrors.accessLevelRoleDoesNotExist(['Bot Admin']);
    }
    if (!interaction.guild.roles.cache.has(server.botAdminRoleID)) {
        throw ExpectedParseErrors.accessLevelRoleDoesNotExist(['Staff']);
    }
    await channelsAreUnderLimit(interaction, 1, numOffices);
    await createOfficeVoiceChannels(server.guild, categoryName, officeName, numOffices, [
        server.botAdminRoleID,
        server.staffRoleID
    ]);
    await interaction.editReply(SuccessMessages.createdOffices(numOffices));
}

/**
 * The `/set_roles` command
 */
async function setRoles(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.set_roles,
        'botAdmin'
    );
    const roleType = interaction.options.getString('role_name', true);
    const role = interaction.options.getRole('role', true);
    const roleIsBotRole = server.guild.roles.cache
        .get(role.id)
        ?.members.some(member => member.user.bot);
    if (roleIsBotRole) {
        throw ExpectedParseErrors.cannotUseBotRoleAsAccessLevelRole;
    }
    switch (roleType) {
        case 'bot_admin': {
            server.setAccessLevelRoleId('botAdmin', role.id);
            await interaction.editReply(SuccessMessages.setBotAdminRole(role.id));
            break;
        }
        case 'staff': {
            server.setAccessLevelRoleId('staff', role.id);
            await interaction.editReply(SuccessMessages.setHelperRole(role.id));
            break;
        }
        case 'student': {
            server.setAccessLevelRoleId('student', role.id);
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
 * Only prompts the "menu". The button presses are handled by button-handlers.ts
 */
async function settingsMenu(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.settings,
        'botAdmin'
    );

    const subMenuJump = interaction.options.getString('sub_menu_jump', false);

    if (subMenuJump === null) {
        await interaction.editReply(SettingsMainMenu(server));
        return;
    }

    // use serverSettingsMainMenuOptions to check if the subMenuJump is valid
    const subMenuOptions = serverSettingsMainMenuOptions.find(
        option => option.selectMenuOptionData.value === subMenuJump
    );

    if (subMenuOptions === undefined) {
        throw new CommandParseError('Invalid sub menu jump.');
    }

    await interaction.editReply(
        subMenuOptions.menu(server, interaction.channelId, false, undefined)
    );
}

/**
 * The `/queue_notify` command
 */
async function joinQueueNotify(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const [server, queue] = [
        AttendingServerV2.get(interaction.guildId),
        hasValidQueueArgument(interaction)
    ];
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.queue_notify,
        'botAdmin'
    );

    const onOrOff = interaction.options.getSubcommand(true);

    if (onOrOff === 'on') {
        await server
            .getQueueById(queue.parentCategoryId)
            .addToNotifGroup(interaction.member);
        await interaction.editReply(SuccessMessages.joinedNotif(queue.queueName));
    } else if (onOrOff === 'off') {
        await server
            .getQueueById(queue.parentCategoryId)
            .removeFromNotifGroup(interaction.member);
        await interaction.editReply(SuccessMessages.removedNotif(queue.queueName));
    } else {
        throw new CommandParseError('Invalid subcommand.');
    }
}

async function setTimeZone(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        CommandNames.set_time_zone,
        'botAdmin'
    );
    // 1 level deep copy, otherwise old and new have the same ref
    // Don't do this on deeply nested objects, use structuredClone instead
    const oldTimezone = { ...server.timezone };
    // no validation here because we have limited the options from the start
    const newTimeZone = {
        sign: interaction.options.getString('sign', true),
        hours: interaction.options.getInteger('hours', true),
        minutes: interaction.options.getInteger('minutes', true)
    } as SimpleTimeZone;
    await server.setTimeZone(newTimeZone);
    await interaction.editReply(
        SuccessMessages.changedTimeZone(oldTimezone, newTimeZone)
    );
}

export { baseYabobCommandMap };
