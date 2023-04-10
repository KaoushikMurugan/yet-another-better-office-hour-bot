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
    isTriggeredByMemberWithRoles,
    isValidDMInteraction
} from './shared-validations.js';
import { ButtonNames } from './interaction-constants/interaction-names.js';
import { SuccessMessages } from './interaction-constants/success-messages.js';
import {
    AfterSessionMessageModal,
    PromptHelpTopicModal,
    QueueAutoClearModal
} from './interaction-constants/modal-objects.js';
import { SimpleEmbed } from '../utils/embed-helper.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { AccessLevelRole } from '../models/access-level-roles.js';
import { HelpMainMenuEmbed, HelpSubMenuEmbed } from './shared-interaction-functions.js';
import {
    QuickStartAutoGiveStudentRole,
    QuickStartLoggingChannel,
    QuickStartPages,
    QuickStartSetRoles
} from '../attending-server/quick-start-pages.js';

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
            [ButtonNames.ServerRoleConfig1SM]: interaction =>
                createAccessLevelRoles(interaction, false, false, 'settings'),
            [ButtonNames.ServerRoleConfig1aSM]: interaction =>
                createAccessLevelRoles(interaction, false, true, 'settings'),
            [ButtonNames.ServerRoleConfig2SM]: interaction =>
                createAccessLevelRoles(interaction, true, false, 'settings'),
            [ButtonNames.ServerRoleConfig2aSM]: interaction =>
                createAccessLevelRoles(interaction, true, true, 'settings'),
            [ButtonNames.ServerRoleConfig1QS]: interaction =>
                createAccessLevelRoles(interaction, false, false, 'quickStart'),
            [ButtonNames.ServerRoleConfig1aQS]: interaction =>
                createAccessLevelRoles(interaction, false, true, 'quickStart'),
            [ButtonNames.ServerRoleConfig2QS]: interaction =>
                createAccessLevelRoles(interaction, true, false, 'quickStart'),
            [ButtonNames.ServerRoleConfig2aQS]: interaction =>
                createAccessLevelRoles(interaction, true, true, 'quickStart'),
            [ButtonNames.DisableAfterSessionMessage]: disableAfterSessionMessage,
            [ButtonNames.DisableQueueAutoClear]: disableQueueAutoClear,
            [ButtonNames.DisableLoggingChannelSM]: interaction =>
                disableLoggingChannel(interaction, 'settings'),
            [ButtonNames.DisableLoggingChannelQS]: interaction =>
                disableLoggingChannel(interaction, 'quickStart'),
            [ButtonNames.AutoGiveStudentRoleConfig1SM]: interaction =>
                toggleAutoGiveStudentRole(interaction, true, 'settings'),
            [ButtonNames.AutoGiveStudentRoleConfig2SM]: interaction =>
                toggleAutoGiveStudentRole(interaction, false, 'settings'),
            [ButtonNames.AutoGiveStudentRoleConfig1QS]: interaction =>
                toggleAutoGiveStudentRole(interaction, true, 'quickStart'),
            [ButtonNames.AutoGiveStudentRoleConfig2QS]: interaction =>
                toggleAutoGiveStudentRole(interaction, false, 'quickStart'),
            [ButtonNames.ShowAfterSessionMessageModal]: showAfterSessionMessageModal,
            [ButtonNames.ShowQueueAutoClearModal]: showQueueAutoClearModal,
            [ButtonNames.PromptHelpTopicConfig1]: interaction =>
                togglePromptHelpTopic(interaction, true),
            [ButtonNames.PromptHelpTopicConfig2]: interaction =>
                togglePromptHelpTopic(interaction, false),
            [ButtonNames.SeriousModeConfig1]: interaction =>
                toggleSeriousMode(interaction, true),
            [ButtonNames.SeriousModeConfig2]: interaction =>
                toggleSeriousMode(interaction, false),
            [ButtonNames.HelpMenuLeft]: interaction =>
                switchHelpMenuPage(interaction, 'left'),
            [ButtonNames.HelpMenuRight]: interaction =>
                switchHelpMenuPage(interaction, 'right'),
            [ButtonNames.HelpMenuBotAdmin]: interaction =>
                showHelpSubMenu(interaction, 'botAdmin'),
            [ButtonNames.HelpMenuStaff]: interaction =>
                showHelpSubMenu(interaction, 'staff'),
            [ButtonNames.HelpMenuStudent]: interaction =>
                showHelpSubMenu(interaction, 'student'),
            [ButtonNames.ReturnToHelpMainMenu]: interaction =>
                returnToHelpMainMenu(interaction),
            [ButtonNames.ReturnToHelpAdminSubMenu]: interaction =>
                returnToHelpSubMenu(interaction, 'botAdmin'),
            [ButtonNames.ReturnToHelpStaffSubMenu]: interaction =>
                returnToHelpSubMenu(interaction, 'staff'),
            [ButtonNames.ReturnToHelpStudentSubMenu]: interaction =>
                returnToHelpSubMenu(interaction, 'student'),
            [ButtonNames.QuickStartBack]: interaction =>
                shiftQuickStartPage(interaction, 'back'),
            [ButtonNames.QuickStartNext]: interaction =>
                shiftQuickStartPage(interaction, 'next')
        }
    },
    dmMethodMap: {
        [ButtonNames.ServerRoleConfig1SM]: interaction =>
            createServerRolesDM(interaction, false, false),
        [ButtonNames.ServerRoleConfig1aSM]: interaction =>
            createServerRolesDM(interaction, false, true),
        [ButtonNames.ServerRoleConfig2SM]: interaction =>
            createServerRolesDM(interaction, true, false),
        [ButtonNames.ServerRoleConfig2aSM]: interaction =>
            createServerRolesDM(interaction, true, true)
    },
    skipProgressMessageButtons: new Set([
        ButtonNames.Join,
        ButtonNames.ReturnToMainMenu,
        ButtonNames.ServerRoleConfig1SM,
        ButtonNames.ServerRoleConfig1aSM,
        ButtonNames.ServerRoleConfig2SM,
        ButtonNames.ServerRoleConfig2aSM,
        ButtonNames.ServerRoleConfig1QS,
        ButtonNames.ServerRoleConfig1aQS,
        ButtonNames.ServerRoleConfig2QS,
        ButtonNames.ServerRoleConfig2aQS,
        ButtonNames.DisableAfterSessionMessage,
        ButtonNames.ShowAfterSessionMessageModal,
        ButtonNames.DisableQueueAutoClear,
        ButtonNames.ShowQueueAutoClearModal,
        ButtonNames.DisableLoggingChannelSM,
        ButtonNames.DisableLoggingChannelQS,
        ButtonNames.AutoGiveStudentRoleConfig1SM,
        ButtonNames.AutoGiveStudentRoleConfig2SM,
        ButtonNames.AutoGiveStudentRoleConfig1QS,
        ButtonNames.AutoGiveStudentRoleConfig2QS,
        ButtonNames.PromptHelpTopicConfig1,
        ButtonNames.PromptHelpTopicConfig2,
        ButtonNames.SeriousModeConfig1,
        ButtonNames.SeriousModeConfig2,
        ButtonNames.HelpMenuLeft,
        ButtonNames.HelpMenuRight,
        ButtonNames.HelpMenuBotAdmin,
        ButtonNames.HelpMenuStaff,
        ButtonNames.HelpMenuStudent,
        ButtonNames.ReturnToHelpMainMenu,
        ButtonNames.ReturnToHelpAdminSubMenu,
        ButtonNames.ReturnToHelpStaffSubMenu,
        ButtonNames.ReturnToHelpStudentSubMenu,
        ButtonNames.QuickStartBack,
        ButtonNames.QuickStartNext
    ])
};

/**
 * Join a queue through button press
 */
async function join(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        AttendingServerV2.get(interaction.guildId),
        isFromQueueChannelWithParent(interaction)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, ButtonNames.Join, 'student');
    if (!server.promptHelpTopic) {
        await interaction.reply({
            ...SimpleEmbed(`Processing button \`Join\` ...`),
            ephemeral: true
        });
    }
    // await server.enqueueStudent(interaction.member, queueChannel);
    await server.getQueueById(queueChannel.parentCategoryId).enqueue(interaction.member);
    server.promptHelpTopic
        ? await interaction.showModal(PromptHelpTopicModal(server.guild.id))
        : await interaction.editReply(
              SuccessMessages.joinedQueue(queueChannel.queueName)
          );
}

/**
 * Leave a queue through button press
 */
async function leave(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        AttendingServerV2.get(interaction.guildId),
        isFromQueueChannelWithParent(interaction)
    ];
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.Leave,
        'student'
    );
    await server
        .getQueueById(queueChannel.parentCategoryId)
        .removeStudent(interaction.member);
    await interaction.editReply(SuccessMessages.leftQueue(queueChannel.queueName));
}

/**
 * Join the notification group with button press
 */
async function joinNotifGroup(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        AttendingServerV2.get(interaction.guildId),
        isFromQueueChannelWithParent(interaction)
    ];
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.Notif,
        'student'
    );
    await server
        .getQueueById(queueChannel.parentCategoryId)
        .addToNotifGroup(interaction.member);
    await interaction.editReply(SuccessMessages.joinedNotif(queueChannel.queueName));
}

/**
 * Leave the notification group with button press
 */
async function leaveNotifGroup(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        AttendingServerV2.get(interaction.guildId),
        isFromQueueChannelWithParent(interaction)
    ];
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.RemoveNotif,
        'student'
    );
    await server
        .getQueueById(queueChannel.parentCategoryId)
        .removeFromNotifGroup(interaction.member);
    await interaction.editReply(SuccessMessages.removedNotif(queueChannel.queueName));
}

/**
 * Displays the Settings Main Menu, used for the ReturnToMainMenu button
 */
async function showSettingsMainMenu(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    await interaction.update(SettingsMainMenu(server));
}

/**
 * Creates the access level roles for the server
 * @param forceCreate if true, will create new roles even if they already exist
 * @param everyoneIsStudent whether to use \@everyone as \@Student
 */
async function createAccessLevelRoles(
    interaction: ButtonInteraction<'cached'>,
    forceCreate: boolean,
    everyoneIsStudent: boolean,
    parent: 'settings' | 'quickStart'
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    await server.createAccessLevelRoles(forceCreate, everyoneIsStudent);
    await interaction.update(
        parent === 'settings'
            ? RolesConfigMenu(
                  server,
                  interaction.channelId,
                  false,
                  forceCreate
                      ? 'New roles have been created!'
                      : 'Role configurations have been updated!'
              )
            : QuickStartSetRoles(
                  server,
                  interaction.channelId,
                  forceCreate
                      ? 'New roles have been created!'
                      : 'Role configurations have been updated!'
              )
    );
}

/**
 * Creates roles for the server in dm channels
 * - This is explicitly used for server initialization
 * @param forceCreate if true, will create new roles even if they already exist
 * @param defaultStudentIsEveryone whether to use \@everyone as \@Student
 */
async function createServerRolesDM(
    interaction: ButtonInteraction,
    forceCreate: boolean,
    everyoneIsStudent: boolean
): Promise<void> {
    const server = isValidDMInteraction(interaction);
    await server.createAccessLevelRoles(forceCreate, everyoneIsStudent);
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
    const server = AttendingServerV2.get(interaction.guildId);
    await interaction.showModal(AfterSessionMessageModal(server.guild.id, true));
}

/**
 * Disable the after session message
 */
async function disableAfterSessionMessage(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
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
    const server = AttendingServerV2.get(interaction.guildId);
    await interaction.showModal(QueueAutoClearModal(server.guild.id, true));
}

/**
 * Disable queue auto clear
 */
async function disableQueueAutoClear(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
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
    interaction: ButtonInteraction<'cached'>,
    parent: 'settings' | 'quickStart'
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    await server.setLoggingChannel(undefined);
    if (parent === 'settings') {
        await interaction.update(
            LoggingChannelConfigMenu(
                server,
                interaction.channelId,
                false,
                `Successfully disabled logging on ${server.guild.name}`
            )
        );
    } else {
        await interaction.update(
            QuickStartLoggingChannel(
                server,
                interaction.channelId,
                `Successfully disabled logging on ${server.guild.name}`
            )
        );
    }
}

/**
 * Toggle whether to give students the student role when they join the server
 * @param autoGiveStudentRole turn on or off auto give student role
 */
async function toggleAutoGiveStudentRole(
    interaction: ButtonInteraction<'cached'>,
    autoGiveStudentRole: boolean,
    parent: 'settings' | 'quickStart'
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    await server.setAutoGiveStudentRole(autoGiveStudentRole);
    if (parent === 'settings') {
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
    } else {
        await interaction.update(
            QuickStartAutoGiveStudentRole(
                server,
                interaction.channelId,
                `Successfully turned ${
                    autoGiveStudentRole ? 'on' : 'off'
                } auto give student role.`
            )
        );
    }
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
    const server = AttendingServerV2.get(interaction.guildId);
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

/**
 * Toggle serious mode for the server
 * @param interaction
 * @param enableSeriousMode
 */
async function toggleSeriousMode(
    interaction: ButtonInteraction<'cached'>,
    enableSeriousMode: boolean
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
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

/**
 * Switch the help menu page forward or backwards (right or left)
 * @param interaction
 * @param leftOrRight direction to switch the page
 * @returns
 */
async function switchHelpMenuPage(
    interaction: ButtonInteraction<'cached'>,
    leftOrRight: 'left' | 'right'
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const oldEmbed = interaction.message.embeds[0];
    const footerText = oldEmbed?.footer?.text.split(' ')[1];
    const oldPage = Number(footerText?.split('/')[0]);
    const maxPage = Number(footerText?.split('/')[1]);
    // invalid parse check
    if (isNaN(oldPage) || isNaN(maxPage)) return;
    // bounds check
    if (
        (leftOrRight === 'left' && oldPage <= 1) ||
        (leftOrRight === 'right' && oldPage === maxPage)
    ) {
        return;
    }
    const helpmenu = HelpSubMenuEmbed(
        server,
        leftOrRight === 'left' ? oldPage - 2 : oldPage
    );
    await interaction.update(helpmenu);
}

async function showHelpSubMenu(
    interaction: ButtonInteraction<'cached'>,
    viewMode: AccessLevelRole
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    await interaction.update(HelpSubMenuEmbed(server, 0, viewMode));
}

async function returnToHelpMainMenu(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const viewMode = await server.getHighestAccessLevelRole(interaction.member);
    await interaction.update(HelpMainMenuEmbed(server, viewMode));
}

async function returnToHelpSubMenu(
    interaction: ButtonInteraction<'cached'>,
    viewMode: AccessLevelRole
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    await interaction.update(HelpSubMenuEmbed(server, 0, viewMode));
}

async function shiftQuickStartPage(
    interaction: ButtonInteraction<'cached'>,
    buttonPressed: 'back' | 'next'
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const oldEmbed = interaction.message.embeds[0];
    const footerText = oldEmbed?.footer?.text.split(' ')[1];
    const oldPage = Number(footerText?.split('/')[0]);
    const maxPage = Number(footerText?.split('/')[1]);
    // invalid parse check
    if (isNaN(oldPage) || isNaN(maxPage)) return;
    // bounds check
    if (
        (buttonPressed === 'back' && oldPage <= 1) ||
        (buttonPressed === 'next' && oldPage === maxPage)
    ) {
        return;
    }
    const newPage = buttonPressed === 'back' ? oldPage - 2 : oldPage;
    const quickStartEmbed = QuickStartPages[newPage];
    if (quickStartEmbed === undefined) {
        return;
    }
    await interaction.update(quickStartEmbed(server, interaction.channelId));
}

export { baseYabobButtonMethodMap };
