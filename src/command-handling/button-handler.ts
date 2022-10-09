import { ButtonInteraction } from 'discord.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server';
import { FgCyan, FgMagenta, FgYellow, ResetColor } from '../utils/command-line-colors';
import {
    EmbedColor,
    ErrorEmbed,
    ButtonLogEmbed,
    SimpleEmbed,
    ErrorLogEmbed
} from '../utils/embed-helper';
import {
    CommandParseError,
    CommandNotImplementedError,
    UserViewableError
} from '../utils/error-types';
import { ButtonCallback } from '../utils/type-aliases';
import { isFromQueueChannelWithParent, isFromGuildMember } from './common-validations';

/**
 * Responsible for preprocessing button presses and dispatching them to servers
 * ----
 * The design is almost identical to CentralCommandDispatcher
 * - Check there for detailed comments
 * The difference here is that a button command is guaranteed to happen in a queue as of right now
 */
class ButtonCommandDispatcher {
    buttonMethodMap: ReadonlyMap<string, ButtonCallback> = new Map<
        string,
        ButtonCallback
    >([
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

    constructor(public serverMap: ReadonlyMap<string, AttendingServerV2>) {}

    async process(interaction: ButtonInteraction): Promise<void> {
        await interaction.editReply(
            SimpleEmbed('Processing button...', EmbedColor.Neutral)
        );
        const delimiterPosition = interaction.customId.indexOf(' ');
        const buttonName = interaction.customId.substring(0, delimiterPosition);
        const queueName = interaction.customId.substring(delimiterPosition + 1);
        const buttonMethod = this.buttonMethodMap.get(buttonName);
        if (buttonMethod === undefined) {
            await interaction.editReply(
                ErrorEmbed(new CommandNotImplementedError('This command does not exist.'))
            );
            return;
        }
        console.log(
            `[${FgCyan}${new Date().toLocaleString('en-US', {
                timeZone: 'PST8PDT'
            })}${ResetColor} ` +
                `${FgYellow}${interaction.guild?.name}${ResetColor}]\n` +
                ` - User: ${interaction.user.username} (${interaction.user.id})\n` +
                ` - Server Id: ${interaction.guildId}\n` +
                ` - Button Pressed: ${FgMagenta}${buttonName}${ResetColor}\n` +
                ` - In Queue: ${queueName}`
        );
        await buttonMethod(queueName, interaction)
            .then(
                async successMsg =>
                    successMsg &&
                    (await interaction.editReply(
                        SimpleEmbed(successMsg, EmbedColor.Success)
                    ))
            )
            .catch(async (err: UserViewableError) => {
                // Central error handling, reply to user with the error
                await interaction.editReply(ErrorEmbed(err));
                const serverId = (await this.isServerInteraction(interaction)) ?? '';
                this.serverMap
                    .get(serverId)
                    ?.sendLogMessage(ErrorLogEmbed(err, interaction));
            });
    }

    private async join(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = await Promise.all([
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            isFromQueueChannelWithParent(interaction, queueName)
        ]);
        const server = this.serverMap.get(serverId);
        await server?.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Join', queueChannel.channelObj)
        );
        await server?.enqueueStudent(member, queueChannel);
        return `Successfully joined \`${queueName}\`.`;
    }

    private async leave(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = await Promise.all([
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            isFromQueueChannelWithParent(interaction, queueName)
        ]);
        const server = this.serverMap.get(serverId);
        await server?.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Leave', queueChannel.channelObj)
        );
        await server?.removeStudentFromQueue(member, queueChannel);
        return `Successfully left \`${queueName}\`.`;
    }

    private async joinNotifGroup(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = await Promise.all([
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            isFromQueueChannelWithParent(interaction, queueName)
        ]);
        const server = this.serverMap.get(serverId);
        await server?.sendLogMessage(
            ButtonLogEmbed(interaction.user, 'Notify When Open', queueChannel.channelObj)
        );
        await server?.addStudentToNotifGroup(member, queueChannel);
        return `Successfully joined notification group for \`${queueName}\``;
    }

    private async leaveNotifGroup(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = await Promise.all([
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            isFromQueueChannelWithParent(interaction, queueName)
        ]);
        const server = this.serverMap.get(serverId);
        await server?.sendLogMessage(
            ButtonLogEmbed(
                interaction.user,
                'Remove Notifications',
                queueChannel.channelObj
            )
        );
        await server?.removeStudentFromNotifGroup(member, queueChannel);
        return `Successfully left notification group for \`${queueName}\``;
    }

    /**
     * Checks if the button came from a server with correctly initialized YABOB
     * ----
     * @returns string: the server id
     */
    private async isServerInteraction(interaction: ButtonInteraction): Promise<string> {
        const serverId = interaction.guild?.id;
        if (!serverId || !this.serverMap.has(serverId)) {
            return Promise.reject(
                new CommandParseError(
                    'I can only accept server based interactions. ' +
                        `Are you sure ${interaction.guild?.name} has a initialized YABOB?`
                )
            );
        } else {
            return serverId;
        }
    }
}

export { ButtonCommandDispatcher };
