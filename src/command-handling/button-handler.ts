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
class BuiltInButtonHandler {

    private methodMap: { [buttonName: string]: ButtonCallback } = {
        join: this.join,
        leave: this.leave,
        notif: this.joinNotifGroup,
        removeN: this.leaveNotifGroup
    } as const;

    canHandle(interaction: ButtonInteraction): boolean {
        const [buttonName] = this.splitButtonQueueName(interaction);
        return buttonName in this.methodMap;
    }

    async process(interaction: ButtonInteraction): Promise<void> {
        const [buttonName, queueName] = this.splitButtonQueueName(interaction);
        const buttonMethod = this.methodMap[buttonName];
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
                    await interaction.editReply(
                        SimpleEmbed(successMsg, EmbedColor.Success)
                    );
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

    private splitButtonQueueName(interaction: ButtonInteraction): [string, string] {
        const delimiterPosition = interaction.customId.indexOf(' ');
        const buttonName = interaction.customId.substring(0, delimiterPosition);
        const queueName = interaction.customId.substring(delimiterPosition + 1);
        return [buttonName, queueName];
    }

    private async join(
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
                ButtonLogEmbed(interaction.user, 'Join', queueChannel.channelObj)
            ),
            server.enqueueStudent(member, queueChannel)
        ]);
        return SuccessMessages.joinedQueue(queueName);
    }

    private async leave(
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
            server.removeStudentFromQueue(member, queueChannel)
        ]);
        return SuccessMessages.leftQueue(queueName);
    }

    private async joinNotifGroup(
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

    private async leaveNotifGroup(
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
}

export { BuiltInButtonHandler };
