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
import { ButtonMethodMap } from '../utils/type-aliases';
import { isFromQueueChannelWithParent, isFromGuildMember } from './common-validations';
import { attendingServers } from '../global-states';
import { ExpectedParseErrors } from './expected-interaction-errors';
import { SuccessMessages } from './builtin-success-messages';

/**
 * Responsible for preprocessing button presses and dispatching them to servers
 * ----
 * @category Handler Classes
 * @see BuiltInCommandHander for detailed comments
 * - The difference here is that a button command is guaranteed to happen in a queue as of right now
 */
class BuiltInButtonHandler {
    private methodMap: ButtonMethodMap = new Map([
        ['join', (queueName, interaction) => this.join(queueName, interaction)],
        ['leave', (queueName, interaction) => this.leave(queueName, interaction)],
        [
            'notif',
            (queueName, interaction) => this.joinNotifGroup(queueName, interaction)
        ],
        [
            'removeN',
            (queueName, interaction) => this.leaveNotifGroup(queueName, interaction)
        ]
    ]);

    canHandle(interaction: ButtonInteraction): boolean {
        const [buttonName] = this.splitButtonQueueName(interaction);
        return this.methodMap.has(buttonName);
    }

    async process(interaction: ButtonInteraction): Promise<void> {
        const [buttonName, queueName] = this.splitButtonQueueName(interaction);
        const buttonMethod = this.methodMap.get(buttonName);
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
                const serverId = this.isServerInteraction(interaction);
                await Promise.all([
                    interaction.replied
                        ? interaction.editReply(ErrorEmbed(err))
                        : interaction.reply({ ...ErrorEmbed(err), ephemeral: true }),
                    attendingServers
                        .get(serverId)
                        ?.sendLogMessage(ErrorLogEmbed(err, interaction))
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
        const [serverId, member, queueChannel] = [
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            isFromQueueChannelWithParent(interaction, queueName)
        ];
        const server = attendingServers.get(serverId);
        await server?.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Join', queueChannel.channelObj)
        );
        await server?.enqueueStudent(member, queueChannel);
        return SuccessMessages.joinedQueue(queueName);
    }

    private async leave(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = [
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            isFromQueueChannelWithParent(interaction, queueName)
        ];
        const server = attendingServers.get(serverId);
        await server?.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
        );
        await server?.removeStudentFromQueue(member, queueChannel);
        return SuccessMessages.leftQueue(queueName);
    }

    private async joinNotifGroup(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = [
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            isFromQueueChannelWithParent(interaction, queueName)
        ];
        const server = attendingServers.get(serverId);
        await server?.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Notify When Open', queueChannel.channelObj)
        );
        await server?.addStudentToNotifGroup(member, queueChannel);
        return SuccessMessages.joinedNotif(queueName);
    }

    private async leaveNotifGroup(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = [
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            isFromQueueChannelWithParent(interaction, queueName)
        ];
        const server = attendingServers.get(serverId);
        await server?.sendLogMessage(
            ButtonLogEmbed(
                interaction.user,
                'Remove Notifications',
                queueChannel.channelObj
            )
        );
        await server?.removeStudentFromNotifGroup(member, queueChannel);
        return SuccessMessages.removedNotif(queueName);
    }

    /**
     * Checks if the button came from a server with correctly initialized YABOB
     * @returns string: the server id
     */
    private isServerInteraction(interaction: ButtonInteraction): string {
        const serverId = interaction.guild?.id;
        if (!serverId || !attendingServers.has(serverId)) {
            throw ExpectedParseErrors.nonServerInterction(interaction.guild?.name);
        } else {
            return serverId;
        }
    }
}

export { BuiltInButtonHandler };
