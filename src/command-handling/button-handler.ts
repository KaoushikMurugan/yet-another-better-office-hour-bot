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
import { ServerConfig } from '../attending-server/server-config-messages.js';

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
const queueButtonMethodMap: { [buttonName: string]: QueueButtonCallback } = {
    join: join,
    leave: leave,
    notif: joinNotifGroup,
    removeN: leaveNotifGroup,
    ssrc1: (queueName, interaction) => createServerRoles(false, false, interaction),
    ssrc1a: (queueName, interaction) => createServerRoles(false, true, interaction),
    ssrc2: (queueName, interaction) => createServerRoles(true, false, interaction),
    ssrc2a: (queueName, interaction) => createServerRoles(true, true, interaction)
} as const;

/**
 * Button method map for DM buttons
 */
const dmButtonMethodMap: { [buttonName: string]: DMButtonCallback } = {
    ssrc1: interaction => createServerRoles_DM(false, false, interaction),
    ssrc1a: interaction => createServerRoles_DM(false, true, interaction),
    ssrc2: interaction => createServerRoles_DM(true, false, interaction),
    ssrc2a: interaction => createServerRoles_DM(true, true, interaction)
} as const;

/**
 * Check if the button interation can be handled by this (in-built) handler
 * @param interaction
 * @returns
 */
function builtInButtonHandlerCanHandle(
    interaction: ButtonInteraction<'cached'>
): boolean {
    const yabobButtonId = parseYabobButtonId(interaction.customId);
    const buttonName = yabobButtonId.n;
    return buttonName in queueButtonMethodMap;
}

/**
 * Check if the button interation can be handled by this (in-built) handler
 * @param interaction
 * @returns
 */
function builtInDMButtonHandlerCanHandle(interaction: ButtonInteraction): boolean {
    const yabobButtonId = parseYabobButtonId(interaction.customId);
    const buttonName = yabobButtonId.n;
    return buttonName in dmButtonMethodMap;
}

/**
 * Handles button presses
 * - Checks if the button press is valid
 * - If so, calls the appropriate function to handle the button press
 * - Returns the appropriate message to send to the user
 * @remark This function is for buttons inside servers. For the version that handles buttons in DMs, see {@link processBuiltInDMButton}
 * @param interaction
 */
async function processBuiltInButton(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    //TODO: Add a check to see if the button press is from a queue channel
    // For now, if queueName is absent, then it is not a queue button
    const yabobButtonId = parseYabobButtonId(interaction.customId);
    const buttonName = yabobButtonId.n;
    const queueName = yabobButtonId.q ?? '';
    const buttonMethod = queueButtonMethodMap[buttonName];
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
    logQueueButtonPress(interaction, buttonName, queueName);
    // if process is called then buttonMethod is definitely not null
    // this is checked in app.ts with `buttonHandler.canHandle`
    await buttonMethod?.(queueName, interaction)
        .then(successMsg => interaction.editReply(successMsg))
        .catch(async err => {
            // Central error handling, reply to user with the error
            const server = isServerInteraction(interaction);
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
 * Handles button presses
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
    logDMButtonPress(interaction, buttonName);
    // if process is called then buttonMethod is definitely not null
    // this is checked in app.ts with `buttonHandler.canHandle`
    await buttonMethod?.(interaction)
        .then(successMsg => interaction.editReply(successMsg))
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
async function createServerRoles(
    forceCreate: boolean,
    defaultStudentIsEveryone: boolean,
    interaction: ButtonInteraction<'cached'>
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
    return ServerConfig.serverRolesConfigMenu(
        server,
        false,
        interaction.channelId,
        false
    );
}

/**
 * Creates roles for the server
 * Version for DM Button Interactions
 * @param forceCreate if true, will create new roles even if they already exist
 * @param interaction
 * @returns
 */
async function createServerRoles_DM(
    forceCreate: boolean,
    defaultStudentIsEveryone: boolean,
    interaction: ButtonInteraction
): Promise<YabobEmbed> {
    const server = isValidDMInteraction(interaction);
    await server.createHierarchyRoles(forceCreate, defaultStudentIsEveryone);
    return ServerConfig.serverRolesConfigMenu(server, false, interaction.channelId, true);
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
