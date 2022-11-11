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
    logQueueButtonPress,
    parseYabobButtonId
} from '../utils/util-functions.js';
import {
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
    loggingChannelConfigMenu,
    queueAutoClearConfigMenu,
    serverRolesConfigMenu
} from '../attending-server/server-config-messages.js';
import { afterSessionMessageModal, queueAutoClearModal } from './modal-objects.js';

/**
 * Responsible for preprocessing button presses and dispatching them to servers
 * ----
 * @category Handler Classes
 * @see BuiltInCommandHander for detailed comments
 * - The difference here is that a button command is guaranteed to happen in a queue as of right now
 */

/**
 * Buttom method map for queue buttons
 */
const queueButtonMethodMap: {
    [buttonName: string]: QueueButtonCallback;
} = {
    join: join,
    leave: leave,
    notif: joinNotifGroup,
    removeN: leaveNotifGroup,
    ssrc1: (queueName, interaction) => createServerRolesMV(interaction, false, false),
    ssrc1a: (queueName, interaction) => createServerRolesMV(interaction, false, true),
    ssrc2: (queueName, interaction) => createServerRolesMV(interaction, true, false),
    ssrc2a: (queueName, interaction) => createServerRolesMV(interaction, true, true),
    asmc2: (queueName, interaction) => disableAfterSessionMessageMV(interaction),
    qacc2: (queueName, interaction) => disableQueueAutoClearMV(interaction),
    lcc2: (queueName, interaction) => disableLoggingChannelMV(interaction)
} as const;

/**
 * Buttons in this object only shows a modal on ButtonInteraction<'cached'>
 * Actual changes to attendingServers happens on modal submit
 * - @see modal-handler.ts
 */
const showModalOnlyButtons: {
    [commandName: string]: (inter: ButtonInteraction<'cached'>) => Promise<void>;
} = {
    asmc1: showAfterSessionMessageModalMV,
    qacc1: showQueueAutoClearModalMV
} as const;

/**
 * Button method map for DM buttons
 */
const dmButtonMethodMap: {
    [buttonName: string]: DMButtonCallback;
} = {
    ssrc1: interaction => createServerRolesDMMV(false, false, interaction),
    ssrc1a: interaction => createServerRolesDMMV(false, true, interaction),
    ssrc2: interaction => createServerRolesDMMV(true, false, interaction),
    ssrc2a: interaction => createServerRolesDMMV(true, true, interaction)
} as const;

/**
 * List of buttons that update the parent interaction
 */
const updateParentInteractionButtons = [
    'ssrc1',
    'ssrc1a',
    'ssrc2',
    'ssrc2a',
    'asmc1',
    'asmc2',
    'qacc1',
    'qacc2',
    'lcc2'
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
    const yabobButtonId = parseYabobButtonId(interaction.customId);
    const buttonName = yabobButtonId.n;
    return buttonName in queueButtonMethodMap || buttonName in showModalOnlyButtons;
}

/**
 * Check if the button interation can be handled by this (in-built) handler
 * @remark This function is for buttons in DMs.
 * See {@link builtInButtonHandlerCanHandle} for the server version.
 * @param interaction
 * @returns True if the interaction can be handled by this handler.
 */
function builtInDMButtonHandlerCanHandle(interaction: ButtonInteraction): boolean {
    const yabobButtonId = parseYabobButtonId(interaction.customId);
    const buttonName = yabobButtonId.n;
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
    const yabobButtonId = parseYabobButtonId(interaction.customId);
    const buttonName = yabobButtonId.n;
    const server = isServerInteraction(interaction);
    // using queue channel get queue name
    const queueName =
        (await server.getQueueChannels()).find(
            queueChannel => queueChannel.channelObj.id === yabobButtonId.c
        )?.queueName ?? '';

    const buttonMethod = queueButtonMethodMap[buttonName];
    const updateParentInteraction = updateParentInteractionButtons.includes(buttonName);
    logQueueButtonPress(interaction, buttonName, queueName);
    if (buttonName in showModalOnlyButtons) {
        await showModalOnlyButtons[buttonName]?.(interaction);
        return;
    }
    if (!updateParentInteraction) {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                ...SimpleEmbed(
                    `Processing button \`${interaction.component.label ?? buttonName}` +
                        (queueName.length > 0 ? `\` in \`${queueName}\` ...` : ''),
                    EmbedColor.Neutral
                )
            });
        } else {
            await interaction.reply({
                ...SimpleEmbed(
                    `Processing button \`${interaction.component.label ?? buttonName}` +
                        (queueName.length > 0 ? `\` in \`${queueName}\` ...` : ''),
                    EmbedColor.Neutral
                ),
                ephemeral: true
            });
        }
    }
    // if process is called then buttonMethod is definitely not null
    // this is checked in app.ts with `buttonHandler.canHandle`
    await buttonMethod?.(queueName, interaction)
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
    const yabobButtonId = parseYabobButtonId(interaction.customId);
    const buttonName = yabobButtonId.n;
    const dmChannelId = yabobButtonId.c;
    const buttonMethod = dmButtonMethodMap[buttonName];
    const updateParentInteraction = updateParentInteractionButtons.includes(buttonName);
    if (!updateParentInteraction) {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                ...SimpleEmbed(
                    `Processing button \`${buttonName}\`` + `In DM ${dmChannelId} ...`,
                    EmbedColor.Neutral
                )
            });
        } else {
            await interaction.reply({
                ...SimpleEmbed(
                    `Processing button \`${buttonName}\`` + `In DM ${dmChannelId} ...`,
                    EmbedColor.Neutral
                ),
                ephemeral: true
            });
        }
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
    await Promise.all([
        server.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
        ),
        server.removeStudentFromQueue(interaction.member, queueChannel)
    ]);
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
    await Promise.all([
        server.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
        ),
        server.addStudentToNotifGroup(interaction.member, queueChannel)
    ]);
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
    await Promise.all([
        server.sendLogMessage(
            ButtonLogEmbed(
                interaction.user,
                'Remove Notifications',
                queueChannel.channelObj
            )
        ),
        server.removeStudentFromNotifGroup(interaction.member, queueChannel)
    ]);
    return SuccessMessages.removedNotif(queueName);
}

/**
 * Creates roles for the server
 * @param forceCreate if true, will create new roles even if they already exist
 * @param interaction
 * @returns
 */
async function createServerRolesMV(
    interaction: ButtonInteraction<'cached'>,
    forceCreate: boolean,
    defaultStudentIsEveryone: boolean
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    await server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            'Setup Roles',
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
async function createServerRolesDMMV(
    forceCreate: boolean,
    defaultStudentIsEveryone: boolean,
    interaction: ButtonInteraction
): Promise<YabobEmbed> {
    const server = isValidDMInteraction(interaction);
    await server.createHierarchyRoles(forceCreate, defaultStudentIsEveryone);
    return serverRolesConfigMenu(server, interaction.channelId, true, false);
}

/**
 * Show the modal for after session message
 * @param interaction
 */
async function showAfterSessionMessageModalMV(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await interaction.showModal(afterSessionMessageModal(server.guild.id, true));
}

/**
 * Disable the after session message
 * @param interaction
 * @returns
 */
async function disableAfterSessionMessageMV(
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    await server.setAfterSessionMessage('');
    return afterSessionMessageConfigMenu(server, interaction.channelId, false);
}

/**
 * Show the modal for queue auto clear
 * @param interaction
 */
async function showQueueAutoClearModalMV(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    await interaction.showModal(queueAutoClearModal(server.guild.id, true));
}

/**
 * Disable queue auto clear
 * @param interaction
 */
async function disableQueueAutoClearMV(
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    await server.setQueueAutoClear(0, 0, false);
    return queueAutoClearConfigMenu(server, interaction.channelId, false);
}

/**
 * Disable logging channel
 * @param interaction
 */
async function disableLoggingChannelMV(
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    await server.setLoggingChannel(undefined);
    return loggingChannelConfigMenu(server, interaction.channelId, false);
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
