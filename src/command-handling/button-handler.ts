import { ButtonInteraction, GuildMember, TextChannel } from "discord.js";
import { AttendingServerV2, QueueChannel } from "../attending-server/base-attending-server";
import { EmbedColor, ErrorEmbed, SimpleEmbed } from "../utils/embed-helper";
import {
    CommandParseError,
    CommandNotImplementedError,
    UserViewableError
} from "../utils/error-types";

class ButtonCommandDispatcher {
    private readonly commandMethodMap = new Map([
        ['join', (queueName: string,
            interaction: ButtonInteraction) => this.join(queueName, interaction)],
        ['leave', (queueName: string,
            interaction: ButtonInteraction) => this.leave(queueName, interaction)],
    ]);

    constructor(private serverMap: Map<string, AttendingServerV2>) { }

    async process(interaction: ButtonInteraction): Promise<void> {
        const delimiterPosition = interaction.customId.indexOf(" ");
        const interactionName = interaction.customId.substring(0, delimiterPosition);
        const queueName = interaction.customId.substring(delimiterPosition + 1);

        const commandMethod = this.commandMethodMap.get(interactionName);
        if (commandMethod !== undefined) {
            await interaction.reply({
                ...SimpleEmbed(
                    'Processing command...',
                    EmbedColor.Neutral
                ),
                ephemeral: true
            });
            console.log(`User ${interaction.user.username} used [${interactionName}] in queue: ${queueName}`);
            await commandMethod(queueName, interaction)
                .then(async successMsg =>
                    await interaction.editReply(
                        SimpleEmbed(
                            successMsg,
                            EmbedColor.Success),
                    ))
                .catch(async (err: UserViewableError) =>
                    await interaction.editReply(
                        ErrorEmbed(err)
                    )); // Central error handling, reply to user with the error
        } else {
            await interaction.reply({
                ...ErrorEmbed(new CommandNotImplementedError(
                    'This command does not exist.'
                )),
                ephemeral: true
            });
        }
    }

    private async join(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(interaction, "Join"),
        ]);

        if (interaction.channel?.type !== 'GUILD_TEXT' ||
            interaction.channel.parent === undefined) {
            return Promise.reject(new CommandParseError(
                'Invalid button press. ' +
                'Make sure this channel has a parent category.'
            ));
        }

        const queueChannel: QueueChannel = {
            channelObj: interaction.channel as TextChannel,
            queueName: queueName
        };

        await this.serverMap.get(serverId)
            ?.enqueueStudent(interaction.member as GuildMember, queueChannel);
        return `Successfully joined \`${queueName}\`.`;
    }

    private async leave(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const [serverId, member] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(interaction, "Leave"),
        ]);

        if (interaction.channel?.type !== 'GUILD_TEXT' ||
            interaction.channel.parent === undefined) {
            return Promise.reject(new CommandParseError(
                'Invalid button press. ' +
                'Make sure this channel has a parent category.'
            ));
        }

        const queueChannel: QueueChannel = {
            channelObj: interaction.channel as TextChannel,
            queueName: queueName
        };

        await this.serverMap.get(serverId)?.removeStudentFromQueue(member, queueChannel);
        return `Successfully left \`${queueName}\`.`;
    }

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
                `You need to have a verified email to use \`[${commandName}]\`.`));
        }
        return interaction.member as GuildMember;
    }

}

export { ButtonCommandDispatcher };