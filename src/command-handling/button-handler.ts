/** @module BuiltInHandlers */
import { ButtonInteraction, TextBasedChannel } from 'discord.js';
import {
    EmbedColor,
    ErrorEmbed,
    ButtonLogEmbed,
    SimpleEmbed,
    ErrorLogEmbed
} from '../utils/embed-helper.js';
import {
    logDMButtonPress,
    logButtonPress
    // parseYabobComponentId
} from '../utils/util-functions.js';
import {
    DefaultButtonCallback,
    DMButtonCallback,
    QueueButtonCallback,
    YabobEmbed
} from '../utils/type-aliases.js';
import {
    isFromQueueChannelWithParent,
    isServerInteraction,
    isValidDMInteraction
} from './common-validations.js';
import { SuccessMessages } from './builtin-success-messages.js';
import {
    afterSessionMessageConfigMenu,
    autoGiveStudentRoleConfigMenu,
    loggingChannelConfigMenu,
    queueAutoClearConfigMenu,
    serverRolesConfigMenu,
    serverSettingsMainMenu
} from '../attending-server/server-settings-menus.js';
import { afterSessionMessageModal, queueAutoClearModal } from './modal-objects.js';
import { buttonFactory } from '../utils/component-id-factory.js';

/**
 * Responsible for preprocessing button presses and dispatching them to servers
 * ----
 * @category Handler Classes
 * @see BuiltInCommandHander for detailed comments
 * - The difference here is that a button command is guaranteed to happen in a queue as of right now
 */

/**
 * Button method map for queue buttons
 */
const queueButtonMethodMap: {
    [buttonName: string]: QueueButtonCallback;
} = {
    join: join,
    leave: leave,
    notif: joinNotifGroup,
    removeN: leaveNotifGroup
} as const;

/**
 * Button method map for non-queue, server buttons
 */
const defaultButtonMethodMap: {
    [buttonName: string]: DefaultButtonCallback;
} = {
    return_to_main_menu: showSettingsMainMenu,
    server_role_config_1: interaction => createServerRoles(interaction, false, false),
    server_role_config_1a: interaction => createServerRoles(interaction, false, true),
    server_role_config_2: interaction => createServerRoles(interaction, true, false),
    server_role_config_2a: interaction => createServerRoles(interaction, true, true),
    after_session_message_config_2: disableAfterSessionMessage,
    queue_auto_clear_config_2: disableQueueAutoClear,
    logging_channel_config_2: disableLoggingChannel,
    auto_give_student_role_config_1: interaction =>
        toggleAutoGiveStudentRole(interaction, true),
    auto_give_student_role_config_2: interaction =>
        toggleAutoGiveStudentRole(interaction, false)
} as const;

/**
 * Buttons in this object only shows a modal on ButtonInteraction<'cached'>
 * Actual changes to attendingServers happens on modal submit
 * - @see modal-handler.ts
 */
const showModalOnlyButtons: {
    [buttonName: string]: (inter: ButtonInteraction<'cached'>) => Promise<void>;
} = {
    after_session_message_config_1: showAfterSessionMessageModal,
    queue_auto_clear_config_1: showQueueAutoClearModal
} as const;

/**
 * Button method map for DM buttons
 */
const dmButtonMethodMap: {
    [buttonName: string]: DMButtonCallback;
} = {
    server_role_config_1: interaction => createServerRolesDM(false, false, interaction),
    server_role_config_1a: interaction => createServerRolesDM(false, true, interaction),
    server_role_config_2: interaction => createServerRolesDM(true, false, interaction),
    server_role_config_2a: interaction => createServerRolesDM(true, true, interaction)
} as const;

/**
 * List of buttons that update the parent interaction
 */
const updateParentInteractionButtons = [
    'return_to_main_menu',
    'server_role_config_1',
    'server_role_config_1a',
    'server_role_config_2',
    'server_role_config_2a',
    'after_session_message_config_1',
    'after_session_message_config_2',
    'queue_auto_clear_config_1',
    'queue_auto_clear_config_2',
    'logging_channel_config_2',
    'auto_give_student_role_config_1',
    'auto_give_student_role_config_2'
];

/**
 * Check if the button interation can be handled by this (in-built) handler
 * @remark This function is for buttons inside servers.
 * See {@link builtInDMButtonHandlerCanHandle} for the dm version.
 * @param interaction
 * @returns True if the interaction can be handled by this handler.
 */
function builtInButtonHandlerCanHandle(
    interaction: ButtonInteraction<'cached'>
): boolean {
    const buttonName = buttonFactory.decompressComponentId(interaction.customId)[1];
    return (
        buttonName in queueButtonMethodMap ||
        buttonName in defaultButtonMethodMap ||
        buttonName in showModalOnlyButtons
    );
}

/**
 * Check if the button interation can be handled by this (in-built) handler
 * @remark This function is for buttons in DMs.
 * See {@link builtInButtonHandlerCanHandle} for the server version.
 * @param interaction
 * @returns True if the interaction can be handled by this handler.
 */
function builtInDMButtonHandlerCanHandle(interaction: ButtonInteraction): boolean {
    const buttonName = buttonFactory.decompressComponentId(interaction.customId)[1];
    return buttonName in dmButtonMethodMap;
}

/**
 * Handles server button presses
 * - Checks if the button press is valid
 * - If so, calls the appropriate function to handle the button press
 * - Returns the appropriate message to send to the user
 * @remark This function is for buttons inside servers. For the version
 * that handlesbuttons in DMs, see {@link processBuiltInDMButton}
 * @param interaction
 */
async function processBuiltInButton(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    // For now, if queueName is absent, then it is not a queue button
    const [buttonType, buttonName, , channelId] = buttonFactory.decompressComponentId(
        interaction.customId
    );
    const server = isServerInteraction(interaction);
    const queueName =
        (await server.getQueueChannels()).find(
            queueChannel => queueChannel.channelObj.id === channelId
        )?.queueName ?? '';
    const updateParentInteraction = updateParentInteractionButtons.includes(buttonName);
    logButtonPress(interaction, buttonName, queueName);
    if (buttonName in showModalOnlyButtons) {
        await showModalOnlyButtons[buttonName]?.(interaction);
        return;
    }
    if (!updateParentInteraction) {
        const progressMsg = SimpleEmbed(
            `Processing button \`${interaction.component.label ?? buttonName}` +
                (queueName.length > 0 ? `\` in \`${queueName}\` ...` : ''),
            EmbedColor.Neutral
        );
        await (interaction.deferred || interaction.replied
            ? interaction.editReply(progressMsg)
            : interaction.reply({ ...progressMsg, ephemeral: true }));
    }
    // if process is called then buttonMethod is definitely not null
    // this is checked in app.ts with `buttonHandler.canHandle`
    await (buttonType === 'queue'
        ? queueButtonMethodMap[buttonName]?.(queueName, interaction)
        : defaultButtonMethodMap[buttonName]?.(interaction)
    )
        ?.then(async successMsg => {
            await (updateParentInteraction
                ? interaction.update(successMsg)
                : interaction.editReply(successMsg));
        })
        .catch(async err => {
            // Central error handling, reply to user with the error
            await Promise.all([
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
 * Handles dm button presses
 * - Checks if the button press is valid
 * - If so, calls the appropriate function to handle the button press
 * - Returns the appropriate message to send to the user
 * @remark This function is for buttons in DMs. For the version that handles buttons in servers, see {@link processBuiltInButton}
 * @param interaction
 */
async function processBuiltInDMButton(interaction: ButtonInteraction): Promise<void> {
    const [, buttonName, , dmChannelId] = buttonFactory.decompressComponentId(
        interaction.customId
    );
    const buttonMethod = dmButtonMethodMap[buttonName];
    const updateParentInteraction = updateParentInteractionButtons.includes(buttonName);
    if (!updateParentInteraction) {
        const progressMsg = SimpleEmbed(
            `Processing button \`${buttonName}\`` + `In DM ${dmChannelId} ...`,
            EmbedColor.Neutral
        );
        await (interaction.deferred || interaction.replied
            ? interaction.editReply(progressMsg)
            : interaction.reply({ ...progressMsg, ephemeral: true }));
    }
    logDMButtonPress(interaction, buttonName);
    // if process is called then buttonMethod is definitely not null
    // this is checked in app.ts with `buttonHandler.canHandle`
    await buttonMethod?.(interaction)
        .then(async successMsg => {
            if (updateParentInteraction) {
                await interaction.update(successMsg);
            } else {
                interaction.replied
                    ? await interaction.reply({ ...successMsg, ephemeral: true })
                    : await interaction.editReply(successMsg);
            }
        })
        .catch(async err => {
            // Central error handling, reply to user with the error
            await Promise.all([
                interaction.replied
                    ? interaction.editReply(ErrorEmbed(err))
                    : interaction.reply({ ...ErrorEmbed(err), ephemeral: true })
            ]);
        });
}

/**
 * Join a queue through button press
 * @param queueName queue to join
 * @param interaction
 * @returns success message
 */
async function join(
    queueName: string,
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction, queueName)
    ];
    await Promise.all([
        server.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Join', queueChannel.channelObj)
        ),
        server.enqueueStudent(interaction.member, queueChannel)
    ]);
    return SuccessMessages.joinedQueue(queueName);
}

/**
 * Leave a queue through button press
 * @param queueName queue to leave
 * @param interaction
 * @returns success message
 */
async function leave(
    queueName: string,
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction, queueName)
    ];
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
    );
    await server.removeStudentFromQueue(interaction.member, queueChannel);
    return SuccessMessages.leftQueue(queueName);
}

/**
 * Join the notification group with button press
 * @param queueName which queue's notif group to join
 * @param interaction
 * @returns success message
 */
async function joinNotifGroup(
    queueName: string,
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction, queueName)
    ];
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
    );
    await server.addStudentToNotifGroup(interaction.member, queueChannel);
    return SuccessMessages.joinedNotif(queueName);
}

/**
 * Leave the notification group with button press
 * @param queueName which queue's notif group to leave
 * @param interaction
 * @returns success message
 */
async function leaveNotifGroup(
    queueName: string,
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction, queueName)
    ];
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, 'Remove Notifications', queueChannel.channelObj)
    );
    await server.removeStudentFromNotifGroup(interaction.member, queueChannel);
    return SuccessMessages.removedNotif(queueName);
}

/**
 * Displays the Settings Main Menu
 * @param interaction
 * @returns
 */
async function showSettingsMainMenu(
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            interaction.component.label ?? 'Return to Settings Main Menu',
            interaction.channel as TextBasedChannel
        )
    );
    return serverSettingsMainMenu(server, interaction.channelId, false);
}

/**
 * Creates roles for the server
 * @param forceCreate if true, will create new roles even if they already exist
 * @param interaction
 * @returns
 */
async function createServerRoles(
    interaction: ButtonInteraction<'cached'>,
    forceCreate: boolean,
    defaultStudentIsEveryone: boolean
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Create Roles ${interaction.component?.label ?? ''}`,
            interaction.channel as TextBasedChannel
        )
    );
    await server.createHierarchyRoles(forceCreate, defaultStudentIsEveryone);
    return serverRolesConfigMenu(server, interaction.channelId, false, false);
}

/**
 * Creates roles for the server
 * Version for DM Button Interactions
 * @param forceCreate if true, will create new roles even if they already exist
 * @param interaction
 * @returns
 */
async function createServerRolesDM(
    forceCreate: boolean,
    defaultStudentIsEveryone: boolean,
    interaction: ButtonInteraction
): Promise<YabobEmbed> {
    const server = isValidDMInteraction(interaction);
    await server.createHierarchyRoles(forceCreate, defaultStudentIsEveryone);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Create Roles ${interaction.component?.label ?? ''}`,
            interaction.channel as TextBasedChannel
        )
    );
    return serverRolesConfigMenu(server, interaction.channelId, true, false);
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
 * @returns
 */
async function disableAfterSessionMessage(
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    await server.setAfterSessionMessage('');
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Disable After Session Message`,
            interaction.channel as TextBasedChannel
        )
    );
    return afterSessionMessageConfigMenu(server, interaction.channelId, false);
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
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    await server.setQueueAutoClear(0, 0, false);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Disable Queue Auto Clear`,
            interaction.channel as TextBasedChannel
        )
    );
    return queueAutoClearConfigMenu(server, interaction.channelId, false);
}

/**
 * Disable logging channel
 * @param interaction
 */
async function disableLoggingChannel(
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    // No logging call here since we're disabling the logging channel
    await server.setLoggingChannel(undefined);
    return loggingChannelConfigMenu(server, interaction.channelId, false);
}

/**
 * Toggle whether to give students the student role when they join the server
 * @param interaction
 * @param autoGiveStudentRole
 * @returns
 */
async function toggleAutoGiveStudentRole(
    interaction: ButtonInteraction<'cached'>,
    autoGiveStudentRole: boolean
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    await server.setAutoGiveStudentRole(autoGiveStudentRole);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Toggle Auto Give Student Role`,
            interaction.channel as TextBasedChannel
        )
    );
    return autoGiveStudentRoleConfigMenu(server, interaction.channelId, false);
}

/**
 * Only export the handler and the 'canHandle' check
 */
export {
    builtInButtonHandlerCanHandle,
    builtInDMButtonHandlerCanHandle,
    processBuiltInButton,
    processBuiltInDMButton
};
