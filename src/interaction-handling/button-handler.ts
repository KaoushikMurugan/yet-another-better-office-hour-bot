import { ButtonHandlerProps } from './handler-interface.js';
import { ButtonNames } from '../command-handling/interaction-names.js';
import { ButtonInteraction, TextBasedChannel } from 'discord.js';
import { SuccessMessages } from '../command-handling/builtin-success-messages.js';
import {
    isServerInteraction,
    isValidDMInteraction
} from '../command-handling/common-validations.js';
import { isFromQueueChannelWithParent } from './shared-validations.js';
import {
    AfterSessionMessageConfigMenu,
    AutoGiveStudentRoleConfigMenu,
    LoggingChannelConfigMenu,
    QueueAutoClearConfigMenu,
    RolesConfigMenu,
    SettingsMainMenu
} from '../attending-server/server-settings-menus.js';
import {
    afterSessionMessageModal,
    queueAutoClearModal
} from '../command-handling/modal/modal-objects.js';
import { ButtonLogEmbed } from '../utils/embed-helper.js';

const baseYabobButtonMethodMap: ButtonHandlerProps = {
    guildMethodMap: {
        queue: {
            [ButtonNames.Join]: join,
            [ButtonNames.Leave]: leave,
            [ButtonNames.Notif]: joinNotifGroup,
            [ButtonNames.RemoveNotif]: leaveNotifGroup
        },
        other: {
            [ButtonNames.ReturnToMainMenu]: showSettingsMainMenu,
            [ButtonNames.ServerRoleConfig1]: interaction =>
                createServerRoles(interaction, false, false),
            [ButtonNames.ServerRoleConfig1a]: interaction =>
                createServerRoles(interaction, false, true),
            [ButtonNames.ServerRoleConfig2]: interaction =>
                createServerRoles(interaction, true, false),
            [ButtonNames.ServerRoleConfig2a]: interaction =>
                createServerRoles(interaction, true, true),
            [ButtonNames.DisableAfterSessionMessage]: disableAfterSessionMessage,
            [ButtonNames.DisableQueueAutoClear]: disableQueueAutoClear,
            [ButtonNames.DisableLoggingChannel]: disableLoggingChannel,
            [ButtonNames.AutoGiveStudentRoleConfig1]: interaction =>
                toggleAutoGiveStudentRole(interaction, true),
            [ButtonNames.AutoGiveStudentRoleConfig2]: interaction =>
                toggleAutoGiveStudentRole(interaction, false),
            [ButtonNames.ShowAfterSessionMessageModal]: showAfterSessionMessageModal,
            [ButtonNames.ShowQueueAutoClearModal]: showQueueAutoClearModal
        }
    },
    dmMethodMap: {
        [ButtonNames.ServerRoleConfig1]: interaction =>
            createServerRolesDM(false, false, interaction),
        [ButtonNames.ServerRoleConfig1a]: interaction =>
            createServerRolesDM(false, true, interaction),
        [ButtonNames.ServerRoleConfig2]: interaction =>
            createServerRolesDM(true, false, interaction),
        [ButtonNames.ServerRoleConfig2a]: interaction =>
            createServerRolesDM(true, true, interaction)
    },
    skipProgressMessageButtons: new Set([
        ButtonNames.ReturnToMainMenu,
        ButtonNames.ServerRoleConfig1,
        ButtonNames.ServerRoleConfig1a,
        ButtonNames.ServerRoleConfig2,
        ButtonNames.ServerRoleConfig2a,
        ButtonNames.DisableAfterSessionMessage,
        ButtonNames.ShowAfterSessionMessageModal,
        ButtonNames.DisableQueueAutoClear,
        ButtonNames.ShowQueueAutoClearModal,
        ButtonNames.DisableLoggingChannel,
        ButtonNames.AutoGiveStudentRoleConfig1,
        ButtonNames.AutoGiveStudentRoleConfig2
    ])
} as const;

/**
 * Join a queue through button press
 * @param queueName queue to join
 * @param interaction
 * @s success message
 */
async function join(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction)
    ];
    await server.enqueueStudent(interaction.member, queueChannel);
    await interaction.editReply(SuccessMessages.joinedQueue(queueChannel.queueName));
}

/**
 * Leave a queue through button press
 * @param queueName queue to leave
 * @param interaction
 * @returns success message
 */
async function leave(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction)
    ];
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
    );
    await server.removeStudentFromQueue(interaction.member, queueChannel);
    SuccessMessages.leftQueue(queueChannel.queueName);
}

/**
 * Join the notification group with button press
 * @param queueName which queue's notif group to join
 * @param interaction
 * @returns success message
 */
async function joinNotifGroup(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction)
    ];
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
    );
    await server.addStudentToNotifGroup(interaction.member, queueChannel);
    await interaction.editReply(SuccessMessages.joinedNotif(queueChannel.queueName));
}

/**
 * Leave the notification group with button press
 * @param queueName which queue's notif group to leave
 * @param interaction
 * @returns success message
 */
async function leaveNotifGroup(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction)
    ];
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, 'Remove Notifications', queueChannel.channelObj)
    );
    await server.removeStudentFromNotifGroup(interaction.member, queueChannel);
    await interaction.editReply(SuccessMessages.removedNotif(queueChannel.queueName));
}

/**
 * Displays the Settings Main Menu
 * @param interaction
 * @s
 */
async function showSettingsMainMenu(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            interaction.component.label ?? ' to Settings Main Menu',
            interaction.channel as TextBasedChannel
        )
    );
    await interaction.update(SettingsMainMenu(server, interaction.channelId, false));
}

/**
 * Creates roles for the server
 * @param forceCreate if true, will create new roles even if they already exist
 * @param interaction
 */
async function createServerRoles(
    interaction: ButtonInteraction<'cached'>,
    forceCreate: boolean,
    defaultStudentIsEveryone: boolean
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.createHierarchyRoles(forceCreate, defaultStudentIsEveryone);
    await interaction.update(
        RolesConfigMenu(server, interaction.channelId, false, false)
    );
}

/**
 * Creates roles for the server
 * Version for DM Button Interactions
 * @param forceCreate if true, will create new roles even if they already exist
 * @param interaction
 * @s
 */
async function createServerRolesDM(
    forceCreate: boolean,
    everyoneIsStudent: boolean,
    interaction: ButtonInteraction
): Promise<void> {
    const server = isValidDMInteraction(interaction);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Create Roles ${interaction.component?.label ?? ''}`,
            interaction.channel as TextBasedChannel
        )
    );
    await server.createHierarchyRoles(forceCreate, everyoneIsStudent);
    console.log(server.hierarchyRoleIds);
    await interaction.update(RolesConfigMenu(server, interaction.channelId, true, false));
}

/**
 * Show the modal for after session message
 * @param interaction
 */
async function showAfterSessionMessageModal(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Set After Session Message`,
            interaction.channel as TextBasedChannel
        )
    );
    await interaction.showModal(afterSessionMessageModal(server.guild.id, true));
}

/**
 * Disable the after session message
 * @param interaction
 * @s
 */
async function disableAfterSessionMessage(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.setAfterSessionMessage('');
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Disable After Session Message`,
            interaction.channel as TextBasedChannel
        )
    );
    await interaction.update(
        AfterSessionMessageConfigMenu(server, interaction.channelId, false)
    );
}

/**
 * Show the modal for queue auto clear
 * @param interaction
 */
async function showQueueAutoClearModal(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Set Queue Auto Clear`,
            interaction.channel as TextBasedChannel
        )
    );
    await interaction.showModal(queueAutoClearModal(server.guild.id, true));
}

/**
 * Disable queue auto clear
 * @param interaction
 */
async function disableQueueAutoClear(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.setQueueAutoClear(0, 0, false);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Disable Queue Auto Clear`,
            interaction.channel as TextBasedChannel
        )
    );
    QueueAutoClearConfigMenu(server, interaction.channelId, false);
}

/**
 * Disable logging channel
 * @param interaction
 */
async function disableLoggingChannel(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    // No logging call here since we're disabling the logging channel
    await server.setLoggingChannel(undefined);
    LoggingChannelConfigMenu(server, interaction.channelId, false);
}

/**
 * Toggle whether to give students the student role when they join the server
 * @param interaction
 * @param autoGiveStudentRole
 * @s
 */
async function toggleAutoGiveStudentRole(
    interaction: ButtonInteraction<'cached'>,
    autoGiveStudentRole: boolean
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.setAutoGiveStudentRole(autoGiveStudentRole);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Toggle Auto Give Student Role`,
            interaction.channel as TextBasedChannel
        )
    );
    AutoGiveStudentRoleConfigMenu(server, interaction.channelId, false);
}

export { baseYabobButtonMethodMap };
