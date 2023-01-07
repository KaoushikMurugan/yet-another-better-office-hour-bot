import { ButtonInteraction } from 'discord.js';
import {
    SettingsMainMenu,
    RolesConfigMenu,
    AfterSessionMessageConfigMenu,
    QueueAutoClearConfigMenu,
    LoggingChannelConfigMenu,
    AutoGiveStudentRoleConfigMenu,
    RolesConfigMenuForServerInit,
    PromptHelpTopicConfigMenu,
    SeriousModeConfigMenu
} from '../attending-server/server-settings-menus.js';
import { ButtonHandlerProps } from './handler-interface.js';
import {
    isFromQueueChannelWithParent,
    isServerInteraction,
    isValidDMInteraction
} from './shared-validations.js';
import { ButtonNames } from './interaction-constants/interaction-names.js';
import { SuccessMessages } from './interaction-constants/success-messages.js';
import {
    afterSessionMessageModal,
    promptHelpTopicModal,
    queueAutoClearModal
} from './interaction-constants/modal-objects.js';
import { SimpleEmbed } from '../utils/embed-helper.js';

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
            [ButtonNames.ShowQueueAutoClearModal]: showQueueAutoClearModal,
            [ButtonNames.PromptHelpTopicConfig1]: interaction =>
                togglePromptHelpTopic(interaction, true),
            [ButtonNames.PromptHelpTopicConfig2]: interaction =>
                togglePromptHelpTopic(interaction, false),
            [ButtonNames.SeriousModeConfig1]: interaction =>
                toggleSeriousMode(interaction, true),
            [ButtonNames.SeriousModeConfig2]: interaction =>
                toggleSeriousMode(interaction, false)
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
        ButtonNames.Join,
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
        ButtonNames.AutoGiveStudentRoleConfig2,
        ButtonNames.PromptHelpTopicConfig1,
        ButtonNames.PromptHelpTopicConfig2,
        ButtonNames.SeriousModeConfig1,
        ButtonNames.SeriousModeConfig2
    ])
} as const;

/**
 * Join a queue through button press
 */
async function join(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction)
    ];
    if (!server.promptHelpTopic) {
        await interaction.reply({
            ...SimpleEmbed(`Processing button \`Join\` ...`),
            ephemeral: true
        });
    }
    await server.enqueueStudent(interaction.member, queueChannel);
    server.promptHelpTopic
        ? await interaction.showModal(promptHelpTopicModal(server.guild.id))
        : await interaction.editReply(
              SuccessMessages.joinedQueue(queueChannel.queueName)
          );
}

/**
 * Leave a queue through button press
 */
async function leave(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction)
    ];
    await server.removeStudentFromQueue(interaction.member, queueChannel);
    await interaction.editReply(SuccessMessages.leftQueue(queueChannel.queueName));
}

/**
 * Join the notification group with button press
 */
async function joinNotifGroup(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction)
    ];
    await server.addStudentToNotifGroup(interaction.member, queueChannel);
    await interaction.editReply(SuccessMessages.joinedNotif(queueChannel.queueName));
}

/**
 * Leave the notification group with button press
 */
async function leaveNotifGroup(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction)
    ];
    await server.removeStudentFromNotifGroup(interaction.member, queueChannel);
    await interaction.editReply(SuccessMessages.removedNotif(queueChannel.queueName));
}

/**
 * Displays the Settings Main Menu, used for the ReturnToMainMenu button
 */
async function showSettingsMainMenu(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await interaction.update(SettingsMainMenu(server, interaction.channelId, false));
}

/**
 * Creates roles for the server
 * @param forceCreate if true, will create new roles even if they already exist
 */
async function createServerRoles(
    interaction: ButtonInteraction<'cached'>,
    forceCreate: boolean,
    defaultStudentIsEveryone: boolean
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.createHierarchyRoles(forceCreate, defaultStudentIsEveryone);
    await interaction.update(
        RolesConfigMenu(
            server,
            interaction.channelId,
            false,
            forceCreate
                ? 'New roles have been created!'
                : 'Role configurations have been updated!',
            false
        )
    );
}

/**
 * Creates roles for the server in dm channels
 * - This is explicitly used for server initialization
 * @param forceCreate if true, will create new roles even if they already exist
 */
async function createServerRolesDM(
    forceCreate: boolean,
    everyoneIsStudent: boolean,
    interaction: ButtonInteraction
): Promise<void> {
    const server = isValidDMInteraction(interaction);
    await server.createHierarchyRoles(forceCreate, everyoneIsStudent);
    await interaction.update(
        RolesConfigMenuForServerInit(server, interaction.channelId, true)
    );
}

/**
 * Show the modal for after session message
 */
async function showAfterSessionMessageModal(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await interaction.showModal(afterSessionMessageModal(server.guild.id, true));
}

/**
 * Disable the after session message
 */
async function disableAfterSessionMessage(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.setAfterSessionMessage('');
    await interaction.update(
        AfterSessionMessageConfigMenu(
            server,
            interaction.channelId,
            false,
            'Successfully disabled after session message.'
        )
    );
}

/**
 * Show the modal for queue auto clear
 */
async function showQueueAutoClearModal(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await interaction.showModal(queueAutoClearModal(server.guild.id, true));
}

/**
 * Disable queue auto clear
 */
async function disableQueueAutoClear(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.setQueueAutoClear(0, 0, false);
    await interaction.update(
        QueueAutoClearConfigMenu(
            server,
            interaction.channelId,
            false,
            `Successfully disabled queue auto clear on ${server.guild.name}`
        )
    );
}

/**
 * Disable logging channel
 */
async function disableLoggingChannel(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.setLoggingChannel(undefined);
    await interaction.update(
        LoggingChannelConfigMenu(
            server,
            interaction.channelId,
            false,
            `Successfully disabled logging on ${server.guild.name}`
        )
    );
}

/**
 * Toggle whether to give students the student role when they join the server
 * @param autoGiveStudentRole turn on or off auto give student role
 */
async function toggleAutoGiveStudentRole(
    interaction: ButtonInteraction<'cached'>,
    autoGiveStudentRole: boolean
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.setAutoGiveStudentRole(autoGiveStudentRole);
    await interaction.update(
        AutoGiveStudentRoleConfigMenu(
            server,
            interaction.channelId,
            false,
            `Successfully turned ${
                autoGiveStudentRole ? 'on' : 'off'
            } auto give student role.`
        )
    );
}

/**
 * Toggle whether to prompt for help topic when a student joins the queue
 * @param interaction
 * @param enablePromptHelpTopic
 */
async function togglePromptHelpTopic(
    interaction: ButtonInteraction<'cached'>,
    enablePromptHelpTopic: boolean
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.setPromptHelpTopic(enablePromptHelpTopic);
    await interaction.update(
        PromptHelpTopicConfigMenu(
            server,
            interaction.channelId,
            false,
            `Successfully turned ${
                enablePromptHelpTopic ? 'on' : 'off'
            } help topic prompt.`
        )
    );
}

async function toggleSeriousMode(
    interaction: ButtonInteraction<'cached'>,
    enableSeriousMode: boolean
): Promise<void> {
    const server = isServerInteraction(interaction);
    await server.setSeriousServer(enableSeriousMode);
    await interaction.update(
        SeriousModeConfigMenu(
            server,
            interaction.channelId,
            false,
            `Successfully turned ${enableSeriousMode ? 'on' : 'off'} serious mode.`
        )
    );
}

export { baseYabobButtonMethodMap };
