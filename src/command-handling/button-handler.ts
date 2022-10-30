/** @module BuiltInHandlers */
import { ButtonInteraction } from 'discord.js';
import {
    EmbedColor,
    ErrorEmbed,
    ButtonLogEmbed,
    SimpleEmbed,
    ErrorLogEmbed
} from '../utils/embed-helper.js';
import { logButtonPress } from '../utils/util-functions.js';
import { ButtonCallback, YabobEmbed } from '../utils/type-aliases.js';
import {
    isFromQueueChannelWithParent,
    isFromGuildMember,
    isServerInteraction
} from './common-validations.js';
import { SuccessMessages } from './builtin-success-messages.js';

/**
 * Responsible for preprocessing button presses and dispatching them to servers
 * ----
 * @category Handler Classes
 * @see BuiltInCommandHander for detailed comments
 * - The difference here is that a button command is guaranteed to happen in a queue as of right now
 */

const buttonMethodMap: { [buttonName: string]: ButtonCallback } = {
    join: join,
    leave: leave,
    notif: joinNotifGroup,
    removeN: leaveNotifGroup
} as const;

/**
 * Check if the button interatoin can be handled by this (in-built) handler
 * @param interaction
 * @returns
 */
function builtInButtonHandlerCanHandle(interaction: ButtonInteraction): boolean {
    const [buttonName] = splitButtonQueueName(interaction);
    return buttonName in buttonMethodMap;
}

/**
 * Handles button presses
 * - Checks if the button press is valid
 * - If so, calls the appropriate function to handle the button press
 * - Returns the appropriate message to send to the user
 * @param interaction
 */
async function processBuiltInButton(interaction: ButtonInteraction): Promise<void> {
    const [buttonName, queueName] = splitButtonQueueName(interaction);
    const buttonMethod = buttonMethodMap[buttonName];
    await interaction.reply({
        ...SimpleEmbed(
            `Processing button \`${
                interaction.component.label ?? buttonName
            }\` in \`${queueName}\` ...`,
            EmbedColor.Neutral
        ),
        ephemeral: true
    });
    logButtonPress(interaction, buttonName, queueName);
    // if process is called then buttonMethod is definitely not null
    // this is checked in app.ts with `buttonHandler.canHandle`
    buttonMethod?.(queueName, interaction)
        .then(successMsg => interaction.editReply(successMsg))
        .catch(async err => {
            // Central error handling, reply to user with the error
            const server = isServerInteraction(interaction);
            await Promise.all([
                interaction.replied
                    ? interaction.editReply(ErrorEmbed(err))
                    : interaction.reply({ ...ErrorEmbed(err), ephemeral: true }),
                server.sendLogMessage(ErrorLogEmbed(err, interaction))
            ]);
        });
}

/**
 * Splits the customId into buttonName and queueName
 * @param interaction
 * @returns string tuple [buttonName, queueName]
 */
function splitButtonQueueName(
    interaction: ButtonInteraction
): [buttonName: string, queueName: string] {
    const delimiterPosition = interaction.customId.indexOf(' ');
    const buttonName = interaction.customId.substring(0, delimiterPosition);
    const queueName = interaction.customId.substring(delimiterPosition + 1);
    return [buttonName, queueName];
}

/**
 * Join a queue through button press
 * @param queueName queue to join
 * @param interaction
 * @returns success message
 */
async function join(
    queueName: string,
    interaction: ButtonInteraction
): Promise<YabobEmbed> {
    const [server, member, queueChannel] = [
        isServerInteraction(interaction),
        isFromGuildMember(interaction),
        isFromQueueChannelWithParent(interaction, queueName)
    ];
    await Promise.all([
        server.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Join', queueChannel.channelObj)
        ),
        server.enqueueStudent(member, queueChannel)
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
    interaction: ButtonInteraction
): Promise<YabobEmbed> {
    const [server, member, queueChannel] = [
        isServerInteraction(interaction),
        isFromGuildMember(interaction),
        isFromQueueChannelWithParent(interaction, queueName)
    ];
    await Promise.all([
        server.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
        ),
        server.removeStudentFromQueue(member, queueChannel)
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
    interaction: ButtonInteraction
): Promise<YabobEmbed> {
    const [server, member, queueChannel] = [
        isServerInteraction(interaction),
        isFromGuildMember(interaction),
        isFromQueueChannelWithParent(interaction, queueName)
    ];
    await Promise.all([
        server.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
        ),
        server.addStudentToNotifGroup(member, queueChannel)
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
    interaction: ButtonInteraction
): Promise<YabobEmbed> {
    const [server, member, queueChannel] = [
        isServerInteraction(interaction),
        isFromGuildMember(interaction),
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
        server.removeStudentFromNotifGroup(member, queueChannel)
    ]);
    return SuccessMessages.removedNotif(queueName);
}

/**
 * Only export the handler and the 'canHandle' check
 */
export { builtInButtonHandlerCanHandle, processBuiltInButton };
