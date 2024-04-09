import {
    ButtonInteraction,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder
} from 'discord.js';
import {
    SettingsMainMenu,
    RoleConfigMenu,
    AfterSessionMessageConfigMenu,
    QueueAutoClearConfigMenu,
    LoggingChannelConfigMenu,
    AutoGiveStudentRoleConfigMenu,
    RoleConfigMenuForServerInit,
    PromptHelpTopicConfigMenu,
    SeriousModeConfigMenu
} from '../attending-server/server-settings-menus.js';
import { ButtonHandlerProps } from './handler-interface.js';
import {
    isFromQueueChannelWithParent,
    isTriggeredByMemberWithRoles,
    isValidDMInteraction
} from './shared-validations.js';
import { ButtonNames, SelectMenuNames } from './interaction-constants/interaction-names.js';
import { SuccessMessages } from './interaction-constants/success-messages.js';
import {
    AfterSessionMessageModal,
    AnnouncementModal,
    PromptHelpTopicModal,
    QueueAutoClearModal
} from './interaction-constants/modal-objects.js';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper.js';
import { AttendingServer } from '../attending-server/base-attending-server.js';
import { AccessLevelRole } from '../models/access-level-roles.js';
import { HelpMainMenuEmbed, HelpSubMenuEmbed } from './shared-interaction-functions.js';
import {
    QuickStartAutoGiveStudentRole,
    QuickStartLoggingChannel,
    quickStartPages,
    QuickStartSetRoles
} from '../attending-server/quick-start-pages.js';
import { buildComponent } from "../utils/component-id-factory.js";
import { YabobEmbed } from "../utils/type-aliases.js";
import { QueueChannel } from "../models/queue-channel.js";

const baseYabobButtonMethodMap: ButtonHandlerProps = {
    guildMethodMap: {
        queue: {
            [ButtonNames.Join]: join,
            [ButtonNames.JoinInPerson]: joinInPerson,
            [ButtonNames.JoinHybrid]: joinHybrid,
            [ButtonNames.Leave]: leave,
            [ButtonNames.Notif]: joinNotifGroup,
            [ButtonNames.RemoveNotif]: leaveNotifGroup
        },
        other: {
            [ButtonNames.Start]: start,
            [ButtonNames.Next]: next,
            [ButtonNames.Stop]: stop,
            [ButtonNames.Pause]: pause,
            [ButtonNames.Resume]: resume,
            [ButtonNames.Announce]: showAnnounceModal,
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
        ButtonNames.JoinInPerson,
        ButtonNames.JoinHybrid,
        ButtonNames.Announce,
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
 * Join a virtual queue through button press
 */
async function join(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        AttendingServer.get(interaction.guildId),
        isFromQueueChannelWithParent(interaction)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, ButtonNames.Join, 'student');
    if (!server.promptHelpTopic) {
        await interaction.reply({
            ...SimpleEmbed(`Processing button \`Join\` ...`),
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
 * Create an in-person select menu
 * FIXME: move to a different file for select menus
 */
function inPersonRoomMenu(
    interaction: ButtonInteraction<'cached'>,
    server: AttendingServer,
    queueChannel: QueueChannel
): YabobEmbed {
    const rooms = server.getInPersonLocationsById(queueChannel.parentCategoryId);
    const embed = new EmbedBuilder()
        .setTitle('Choose a Room for In-Person Help')
        .setColor(EmbedColor.Aqua);

    const roomSelectMenu =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            buildComponent(new StringSelectMenuBuilder(), [
                'other',
                SelectMenuNames.InPersonRoomMenu,
                server.guild.id
            ])
                .setPlaceholder('Select a Room')
                .addOptions(
                    // Cannot have more than 25 options
                    rooms.map(room => ({
                        label: room,
                        value: room
                    }))
                )
        );
    return {
        embeds: [embed.data],
        components: [roomSelectMenu]
    };
}

/**
 * Join an in-person queue through button press
 */
async function joinInPerson(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        AttendingServer.get(interaction.guildId),
        isFromQueueChannelWithParent(interaction)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, ButtonNames.JoinInPerson, 'student');

    await interaction.reply({
        ...SimpleEmbed(`Processing button \`Join In-Person\` ...`),
        ephemeral: true
    });

    const message = await interaction.editReply(inPersonRoomMenu(interaction, server, queueChannel));

    const collector = message.createMessageComponentCollector({
        filter: (u) => {
            return u.user.id === interaction.user.id;
        }
    });

    collector.on('collect', async (buttonInteraction) => {
        if (server.promptHelpTopic) {
            await buttonInteraction.showModal(PromptHelpTopicModal(server.guild.id));
        }
        else {
            await buttonInteraction.reply(SuccessMessages.joinedQueue(queueChannel.queueName));
        }
    });
}

/**
 * Join virtual and in-person queues through button press
 */
async function joinHybrid(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        AttendingServer.get(interaction.guildId),
        isFromQueueChannelWithParent(interaction)
    ];
    isTriggeredByMemberWithRoles(server, interaction.member, ButtonNames.JoinHybrid, 'student');

    await interaction.reply({
        ...SimpleEmbed(`Processing button \`Join In-Person\` ...`),
        ephemeral: true
    });

    // Join virtual queue
    await server.getQueueById(queueChannel.parentCategoryId).enqueue(interaction.member);

    // Join in-person queue
    const message = await interaction.editReply(inPersonRoomMenu(interaction, server, queueChannel));

    const collector = message.createMessageComponentCollector({
        filter: (u) => {
            return u.user.id === interaction.user.id;
        }
    });

    collector.on('collect', async (buttonInteraction) => {
        if (server.promptHelpTopic) {
            await buttonInteraction.showModal(PromptHelpTopicModal(server.guild.id));
        }
        else {
            await buttonInteraction.reply(SuccessMessages.joinedQueue(queueChannel.queueName));
        }
    });
}

/**
 * Leave queues through button press
 */
async function leave(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        AttendingServer.get(interaction.guildId),
        isFromQueueChannelWithParent(interaction)
    ];
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.Leave,
        'student'
    );
    await Promise.all(
        server.getAllQueuesWithHelpee(queueChannel.parentCategoryId, interaction.member)
            .map(queue => queue.removeStudent(interaction.member))
    );
    await interaction.editReply(SuccessMessages.leftQueue(queueChannel.queueName));
}

/**
 * Join the notification group with button press
 */
async function joinNotifGroup(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [server, queueChannel] = [
        AttendingServer.get(interaction.guildId),
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
        AttendingServer.get(interaction.guildId),
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
 * Equivalent to the `/start mute_notifs:true` command
 * @param interaction
 */
async function start(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.Start,
        'staff'
    );
    await server.openAllOpenableQueues(member, 'virtual', true);
    await interaction.editReply(SuccessMessages.startedHelping);
}

/**
 * The `/next` command, both with arguments or without arguments
 */
async function next(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const helperMember = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.Next,
        'staff'
    );
    const dequeuedStudent = await server.dequeueGlobalFirst(helperMember);
    const helpTopic = dequeuedStudent.helpTopic;
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
 * Equivalent to the `/stop` command
 * @param interaction
 */
async function stop(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.Stop,
        'staff'
    );
    const helpTimeEntry = await server.closeAllClosableQueues(member);
    await interaction.editReply(SuccessMessages.finishedHelping(helpTimeEntry));
}

/**
 * The `/pause` command
 */
async function pause(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.Pause,
        'staff'
    );
    const existOtherActiveHelpers = await server.pauseHelping(member);
    await interaction.editReply(SuccessMessages.pausedHelping(existOtherActiveHelpers));
}

/**
 * The `/resume` command
 */
async function resume(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.Resume,
        'staff'
    );
    await server.resumeHelping(member);
    await interaction.editReply(SuccessMessages.resumedHelping);
}

/**
 * Shows the announcement modal after [ANNOUNCE] button is pressed
 * @param interaction
 */
async function showAnnounceModal(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        ButtonNames.Announce,
        'staff'
    );
    await interaction.showModal(AnnouncementModal(server.guild.id));
}

/**
 * Displays the Settings Main Menu, used for the ReturnToMainMenu button
 */
async function showSettingsMainMenu(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
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
    const server = AttendingServer.get(interaction.guildId);
    await server.createAccessLevelRoles(forceCreate, everyoneIsStudent);
    await interaction.update(
        parent === 'settings'
            ? RoleConfigMenu(
                  server,
                  false,
                  forceCreate
                      ? 'New roles have been created!'
                      : 'Role configurations have been updated!'
              )
            : QuickStartSetRoles(
                  server,
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
    await interaction.update(RoleConfigMenuForServerInit(server, true));
}

/**
 * Show the modal for after session message
 */
async function showAfterSessionMessageModal(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    await interaction.showModal(AfterSessionMessageModal(server.guild.id, true));
}

/**
 * Disable the after session message
 */
async function disableAfterSessionMessage(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    await server.setAfterSessionMessage('');
    await interaction.update(
        AfterSessionMessageConfigMenu(
            server,
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
    const server = AttendingServer.get(interaction.guildId);
    await interaction.showModal(QueueAutoClearModal(server.guild.id, true));
}

/**
 * Disable queue auto clear
 */
async function disableQueueAutoClear(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    await server.setQueueAutoClear(0, 0, false);
    await interaction.update(
        QueueAutoClearConfigMenu(
            server,
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
    const server = AttendingServer.get(interaction.guildId);
    await server.setLoggingChannel(undefined);
    if (parent === 'settings') {
        await interaction.update(
            LoggingChannelConfigMenu(
                server,
                false,
                `Successfully disabled logging on ${server.guild.name}`
            )
        );
    } else {
        await interaction.update(
            QuickStartLoggingChannel(
                server,
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
    const server = AttendingServer.get(interaction.guildId);
    await server.setAutoGiveStudentRole(autoGiveStudentRole);
    if (parent === 'settings') {
        await interaction.update(
            AutoGiveStudentRoleConfigMenu(
                server,
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
    const server = AttendingServer.get(interaction.guildId);
    await server.setPromptHelpTopic(enablePromptHelpTopic);
    await interaction.update(
        PromptHelpTopicConfigMenu(
            server,
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
    const server = AttendingServer.get(interaction.guildId);
    await server.setSeriousServer(enableSeriousMode);
    await interaction.update(
        SeriousModeConfigMenu(
            server,
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
    const server = AttendingServer.get(interaction.guildId);
    const footerText = interaction.message.embeds[0]?.footer?.text.split(' ')[1];
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
    const helpMenu = HelpSubMenuEmbed(
        server,
        leftOrRight === 'left' ? oldPage - 2 : oldPage
    );
    await interaction.update(helpMenu);
}

async function showHelpSubMenu(
    interaction: ButtonInteraction<'cached'>,
    viewMode: AccessLevelRole
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    await interaction.update(HelpSubMenuEmbed(server, 0, viewMode));
}

async function returnToHelpMainMenu(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const viewMode = server.getHighestAccessLevelRole(interaction.member);
    await interaction.update(HelpMainMenuEmbed(server, viewMode));
}

async function returnToHelpSubMenu(
    interaction: ButtonInteraction<'cached'>,
    viewMode: AccessLevelRole
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    await interaction.update(HelpSubMenuEmbed(server, 0, viewMode));
}

async function shiftQuickStartPage(
    interaction: ButtonInteraction<'cached'>,
    buttonPressed: 'back' | 'next'
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const footerText = interaction.message.embeds[0]?.footer?.text.split(' ')[1];
    const oldPage = Number(footerText?.split('/')[0]);
    const maxPage = Number(footerText?.split('/')[1]);
    // invalid parse check
    if (isNaN(oldPage) || isNaN(maxPage)) {
        return;
    }
    // bounds check
    if (
        (buttonPressed === 'back' && oldPage <= 1) ||
        (buttonPressed === 'next' && oldPage === maxPage)
    ) {
        return;
    }
    const newPage = buttonPressed === 'back' ? oldPage - 2 : oldPage;
    const quickStartEmbed = quickStartPages[newPage];
    if (quickStartEmbed === undefined) {
        return;
    }
    await interaction.update(quickStartEmbed(server));
}

export { baseYabobButtonMethodMap };
