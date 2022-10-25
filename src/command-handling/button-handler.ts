/** @module BuiltInHandlers */
import { ButtonInteraction } from 'discord.js';
import {
    EmbedColor,
    ErrorEmbed,
    ButtonLogEmbed,
    SimpleEmbed,
    ErrorLogEmbed
} from '../utils/embed-helper';
import { logButtonPress } from '../utils/util-functions';
import { ButtonCallback } from '../utils/type-aliases';
import {
    isFromQueueChannelWithParent,
    isFromGuildMember,
    isServerInteraction
} from './common-validations';
import { SuccessMessages } from './builtin-success-messages';

/**
 * Responsible for preprocessing button presses and dispatching them to servers
 * ----
 * @category Handler Classes
 * @see BuiltInCommandHander for detailed comments
 * - The difference here is that a button command is guaranteed to happen in a queue as of right now
 */

const methodMap: { [buttonName: string]: ButtonCallback } = {
    join: join,
    leave: leave,
    notif: joinNotifGroup,
    removeN: leaveNotifGroup
} as const;

function builtInButtonHandlerCanHandle(interaction: ButtonInteraction): boolean {
    const [buttonName] = splitButtonQueueName(interaction);
    return buttonName in methodMap;
}

async function processBuiltInButton(interaction: ButtonInteraction): Promise<void> {
    const [buttonName, queueName] = splitButtonQueueName(interaction);
    const buttonMethod = methodMap[buttonName];
    await interaction.reply({
        ...SimpleEmbed(
            `Processing button \`${buttonName}\` in \`${queueName}\` ...`,
            EmbedColor.Neutral
        ),
        ephemeral: true
    });
    logButtonPress(interaction, buttonName, queueName);
    // if process is called then buttonMethod is definitely not null
    // this is checked in app.ts with `buttonHandler.canHandle`
    await buttonMethod?.(queueName, interaction)
        .then(async successMsg => {
            if (successMsg) {
                await interaction.editReply(SimpleEmbed(successMsg, EmbedColor.Success));
            }
        })
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

function splitButtonQueueName(interaction: ButtonInteraction): [string, string] {
    const delimiterPosition = interaction.customId.indexOf(' ');
    const buttonName = interaction.customId.substring(0, delimiterPosition);
    const queueName = interaction.customId.substring(delimiterPosition + 1);
    return [buttonName, queueName];
}

async function join(queueName: string, interaction: ButtonInteraction): Promise<string> {
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

async function leave(queueName: string, interaction: ButtonInteraction): Promise<string> {
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

async function joinNotifGroup(
    queueName: string,
    interaction: ButtonInteraction
): Promise<string> {
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

async function leaveNotifGroup(
    queueName: string,
    interaction: ButtonInteraction
): Promise<string> {
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

export { builtInButtonHandlerCanHandle, processBuiltInButton };
