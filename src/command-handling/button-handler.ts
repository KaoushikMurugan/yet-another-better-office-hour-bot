import { ButtonInteraction, GuildMember, TextChannel } from "discord.js";
import { AttendingServerV2, QueueChannel } from "../attending-server/base-attending-server";
import { FgCyan, ResetColor } from "../utils/command-line-colors";
import { EmbedColor, ErrorEmbed, SimpleEmbed } from "../utils/embed-helper";
import {
    CommandParseError,
    CommandNotImplementedError,
    UserViewableError
} from "../utils/error-types";


/**
 * Responsible for preprocessing button presses and dispatching them to servers
 * ----
 * The design is almost identical to CentralCommandDispatcher
 * - Check there for detailed comments
 * The difference here is that a button command is guaranteed to happen in a queue as of right now
*/
class ButtonCommandDispatcher {
    public buttonMethodMap: ReadonlyMap<
        string,
        (queueName: string, interaction: ButtonInteraction) => Promise<string>
    > = new Map([
        ['join', (queueName: string,
            interaction: ButtonInteraction) => this.join(queueName, interaction)],
        ['leave', (queueName: string,
            interaction: ButtonInteraction) => this.leave(queueName, interaction)],
        ['notif', (queueName: string,
            interaction: ButtonInteraction) => this.joinNotifGroup(queueName, interaction)],
        ['removeN', (queueName: string,
            interaction: ButtonInteraction) => this.leaveNotifGroup(queueName, interaction)]
    ]);

    constructor(private serverMap: Map<string, AttendingServerV2>) { }

    async process(interaction: ButtonInteraction): Promise<void> {
        await interaction.reply({
            ...SimpleEmbed(
                'Processing command...',
                EmbedColor.Neutral
            ),
            ephemeral: true
        });
        const delimiterPosition = interaction.customId.indexOf(" ");
        const interactionName = interaction.customId.substring(0, delimiterPosition);
        const queueName = interaction.customId.substring(delimiterPosition + 1);
        const buttonMethod = this.buttonMethodMap.get(interactionName);
        if (buttonMethod !== undefined) {
            console.log(
                `[${FgCyan}${(new Date).toLocaleString()}${ResetColor}]` +
                `User ${interaction.user.username} ` +
                `used [${interactionName}] ` +
                `in queue: ${queueName}.`
            );
            await buttonMethod(queueName, interaction)
                .then(async successMsg =>
                    await interaction.editReply(SimpleEmbed(
                        successMsg,
                        EmbedColor.Success),
                    ))
                .catch(async (err: UserViewableError) =>
                    await interaction.editReply(
                        ErrorEmbed(err)
                    )); // Central error handling, reply to user with the error
        } else {
            await interaction.editReply(ErrorEmbed(
                new CommandNotImplementedError('This command does not exist.'))
            );
        }
    }

    private async join(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(interaction, "Join"),
            this.isFromQueueChannelWithParent(interaction, queueName)
        ]);

        await this.serverMap.get(serverId)
            ?.enqueueStudent(member, queueChannel);
        return `Successfully joined \`${queueName}\`.`;
    }

    private async leave(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(interaction, "Leave"),
            this.isFromQueueChannelWithParent(interaction, queueName)
        ]);

        await this.serverMap.get(serverId)
            ?.removeStudentFromQueue(member, queueChannel);
        return `Successfully left \`${queueName}\`.`;
    }

    private async joinNotifGroup(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(interaction, "JoinNotif"),
            this.isFromQueueChannelWithParent(interaction, queueName)
        ]);

        await this.serverMap.get(serverId)?.addStudentToNotifGroup(member, queueChannel);
        return `Successfully joined notification group for \`${queueName}\``;
    }

    private async leaveNotifGroup(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member, queueChannel] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(interaction, "LeaveNotif"),
            this.isFromQueueChannelWithParent(interaction, queueName)
        ]);

        await this.serverMap.get(serverId)?.removeStudentFromNotifGroup(member, queueChannel);
        return `Successfully left notification group for \`${queueName}\``;
    }


    // Begin Validation functions

    private async isServerInteraction(
        interaction: ButtonInteraction
    ): Promise<string> {
        const serverId = interaction.guild?.id;
        if (!serverId || !this.serverMap.has(serverId)) {
            return Promise.reject(new CommandParseError(
                'I can only accept server based interactions. '
                + `Are you sure ${interaction.guild?.name} has a initialized YABOB?`));
        } else {
            return serverId;
        }
    }

    private async isTriggeredByUserWithValidEmail(
        interaction: ButtonInteraction,
        commandName: string
    ): Promise<GuildMember> {
        const roles = (await (interaction.member as GuildMember)?.fetch())
            .roles.cache.map(role => role.name);
        if (!(interaction.member instanceof GuildMember &&
            roles.includes('Verified Email'))) {
            return Promise.reject(new CommandParseError(
                `You need to have a verified email to use button \`[${commandName}]\`.`));
        }
        return interaction.member as GuildMember;
    }

    /**
     * Checks if the queue channel has a parent folder
     * ----
    */
    private isFromQueueChannelWithParent(
        interaction: ButtonInteraction,
        queueName: string
    ): Promise<QueueChannel> {
        if (interaction.channel?.type !== 'GUILD_TEXT' ||
            interaction.channel.parent === null) {
            return Promise.reject(new CommandParseError(
                'Invalid button press. ' +
                'Make sure this channel has a parent category.'
            ));
        }
        const queueChannel: QueueChannel = {
            channelObj: interaction.channel as TextChannel,
            queueName: queueName,
            parentCategoryId: interaction.channel.parent.id
        };
        return Promise.resolve(queueChannel);
    }

}

export { ButtonCommandDispatcher };