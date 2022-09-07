import { CommandInteraction, GuildChannel } from "discord.js";
import { AttendingServerV2 } from "../attending-server/base-attending-server";
import { FgCyan, ResetColor } from "../utils/command-line-colors";
import { EmbedColor, SimpleEmbed, ErrorEmbed } from "../utils/embed-helper";
import {
    CommandNotImplementedError,
    CommandParseError, UserViewableError
} from '../utils/error-types';
import {
    isTriggeredByUserWithRoles,
    hasValidQueueArgument,
    isFromGuildMember
} from './common-validations';

/**
 * Responsible for preprocessing commands and dispatching them to servers
 * ----
 * - Each YABOB instance should only have 1 central command dispatcher
 * All the functions below follows this convention:
 *      private async <corresponding command name>(interaction): Promise<string>
 * @param interaction the raw interaction
 * @throws CommandParseError: if command doesn't satify the checks in Promise.all
 * @throws QueueError or ServerError: if the target HelpQueueV2 or AttendingServer rejects
 * @returns string: the success message
 */
class CentralCommandDispatcher {

    // The map of available commands
    // Key is what the user will see, value is the arrow function
    public commandMethodMap: ReadonlyMap<
        string,
        (interaction: CommandInteraction) => Promise<string>
    > = new Map([
        ['announce', (interaction: CommandInteraction) => this.announce(interaction)],
        ['cleanup', (interaction: CommandInteraction) => this.cleanup(interaction)],
        ['cleanup_help_ch', (interaction: CommandInteraction) => this.cleanupHelpChannel(interaction)],
        ['clear', (interaction: CommandInteraction) => this.clear(interaction)],
        ['enqueue', (interaction: CommandInteraction) => this.enqueue(interaction)],
        ['leave', (interaction: CommandInteraction) => this.leave(interaction)],
        ['list_helpers', (interaction: CommandInteraction) => this.listHelpers(interaction)],
        ['next', (interaction: CommandInteraction) => this.next(interaction)],
        ['queue', (interaction: CommandInteraction) => this.queue(interaction)],
        ['set_after_session_msg', (interaction: CommandInteraction) => this.setAfterSessionMessage(interaction)],
        ['start', (interaction: CommandInteraction) => this.start(interaction)],
        ['stop', (interaction: CommandInteraction) => this.stop(interaction)],
    ]);

    // key is Guild.id, same as servers map from app.ts
    constructor(private serverMap: Map<string, AttendingServerV2>) { }

    /**
     * Main processor for command interactions
     * ----
     * @param interaction the raw interaction from discord js
     * @throws UserViewableError: when the command exists but failed
     * @throws CommandNotImplementedError: if the command is not implemented
     * - If thrown but the command is implemented, make sure commandMethodMap has it
    */
    async process(interaction: CommandInteraction): Promise<void> {
        // Immediately replay to show that YABOB has received the interaction
        await interaction.reply({
            ...SimpleEmbed(
                'Processing command...',
                EmbedColor.Neutral
            ),
            ephemeral: true
        });
        // Check the hashmap to see if the command exists as a key
        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (commandMethod !== undefined) {
            console.log(
                `[${FgCyan}${(new Date).toLocaleString()}${ResetColor}]` +
                ` User ${interaction.user.username}` +
                ` used ${interaction.toString()}`
            );
            await commandMethod(interaction)
                .then(async successMsg =>
                    await interaction.editReply(
                        SimpleEmbed(
                            successMsg,
                            EmbedColor.Success)
                    ))
                .catch(async (err: UserViewableError) =>
                    await interaction.editReply(
                        ErrorEmbed(err)
                    )); // Central error handling, reply to user with the error
        } else {
            await interaction.editReply(ErrorEmbed(
                new CommandNotImplementedError('This command does not exist.')
            ));
        }
    }

    private async queue(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                `queue ${interaction.options.getSubcommand()}`,
                ['Bot Admin'])
        ]);

        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case "add": {
                const queueName = interaction.options.getString("queue_name", true);
                await this.serverMap.get(serverId)?.createQueue(queueName);
                return `Successfully created \`${queueName}\`.`;
            }
            case "remove": {
                const targetQueue = await hasValidQueueArgument(interaction, true);
                if ((interaction.channel as GuildChannel).parent?.id ===
                    targetQueue.parentCategoryId) {
                    return Promise.reject(new CommandParseError(
                        `Please use the remove command in another channel.` +
                        ` Otherwise Discord API will reject.`
                    ));
                }
                await this.serverMap.get(serverId)
                    ?.deleteQueueById(targetQueue.parentCategoryId);
                return `Successfully deleted \`${targetQueue.queueName}\`.`;
            }
            default: {
                return Promise.reject(new CommandParseError(
                    `Invalid /queue subcommand ${subcommand}.`));
            }
        }
    }

    private async enqueue(interaction: CommandInteraction): Promise<string> {
        const [serverId, queueChannel, member] = await Promise.all([
            this.isServerInteraction(interaction),
            hasValidQueueArgument(interaction),
            isFromGuildMember(interaction),
        ]);
        await this.serverMap.get(serverId)?.enqueueStudent(member, queueChannel);
        return `Successfully joined \`${queueChannel.queueName}\`.`;
    }

    private async next(interaction: CommandInteraction): Promise<string> {
        const [serverId, member] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                "next",
                ['Bot Admin', 'Staff'])
        ]);
        const student = await this.serverMap.get(serverId)?.dequeueFirst(member);
        return `An invite has been sent to ${student?.member.displayName}.`;
    }

    private async start(interaction: CommandInteraction): Promise<string> {
        const [serverId, member] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                "start",
                ['Bot Admin', 'Staff'])
        ]);
        const muteNotif = interaction.options.getBoolean('mute_notif') ?? false;
        await this.serverMap.get(serverId)?.openAllOpenableQueues(member, !muteNotif);
        return `You have started helping! Have Fun!`;
    }

    private async stop(interaction: CommandInteraction): Promise<string> {
        const [serverId, member] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                "stop",
                ['Bot Admin', 'Staff'])
        ]);

        const helpTime = await this.serverMap.get(serverId)?.closeAllClosableQueues(member);
        const totalSeconds = Math.round(Math.abs(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            helpTime!.helpStart.getTime() - helpTime!.helpEnd!.getTime()
        ) / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        return `You helped for ` +
            (hours > 0
                ? `${hours} hours and ${((totalSeconds - hours * 3600) / 60).toFixed(2)} minutes. `
                : `${(totalSeconds / 60).toFixed(2)} minutes. `) +
            `See you later!`;
    }

    private async leave(interaction: CommandInteraction): Promise<string> {
        const [serverId, member, queue] = await Promise.all([
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            hasValidQueueArgument(interaction)
        ]);
        await this.serverMap.get(serverId)?.removeStudentFromQueue(member, queue);
        return `You have successfully left from queue ${queue.queueName}.`;
    }

    private async clear(interaction: CommandInteraction): Promise<string> {
        const [serverId, queue] = await Promise.all([
            this.isServerInteraction(interaction),
            hasValidQueueArgument(interaction, true),
            isTriggeredByUserWithRoles(
                interaction,
                "clear",
                ['Bot Admin', 'Staff']
            )
        ]);
        await this.serverMap.get(serverId)?.clearQueue(queue);
        return `Everyone in  queue ${queue.queueName} was removed.`;
    }

    private async listHelpers(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction)
        ]);
        const helpers = this.serverMap.get(serverId ?? '')?.helperNames;
        if (helpers === undefined || helpers.size === 0) {
            return `No one is currently helping.`;
        }
        return `[${[...helpers].join('\n')}]\n${helpers.size === 1 ? 'is' : 'are'} helping.`;
    }

    private async announce(interaction: CommandInteraction): Promise<string> {
        const [serverId, member] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                'announce',
                ['Bot Admin', 'Staff']
            )
        ]);
        const announcement = interaction.options.getString("message", true);
        const optionalChannel = interaction.options.getChannel("queue_name", false);
        if (optionalChannel) {
            const queueChannel = await hasValidQueueArgument(interaction);
            await this.serverMap.get(serverId)
                ?.announceToStudentsInQueue(member, announcement, queueChannel);
        } else {
            await this.serverMap.get(serverId)
                ?.announceToStudentsInQueue(member, announcement);
        }
        return `Your announcement: ${announcement} has been sent!`;
    }

    private async cleanup(interaction: CommandInteraction): Promise<string> {
        const [serverId, queue] = await Promise.all([
            this.isServerInteraction(interaction),
            hasValidQueueArgument(interaction, true),
            isTriggeredByUserWithRoles(
                interaction,
                'cleanup',
                ['Bot Admin']
            ),
        ]);
        await this.serverMap.get(serverId)?.cleanUpQueue(queue);
        return `Queue ${queue.queueName} has been cleaned up.`;
    }

    private async cleanupHelpChannel(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                'cleanup_help_channel',
                ['Bot Admin']
            )
        ]);
        await this.serverMap.get(serverId)?.updateCommandHelpChannels();
        return `Successfully cleaned up everything under 'Bot Commands Help'.`;
    }

    private async setAfterSessionMessage(
        interaction: CommandInteraction
    ): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                'set_after_session_msg',
                ['Bot Admin']
            ),
        ]);
        const enableAfterSessionMessage = interaction.options.getBoolean(`enable`, true);
        const newAfterSessionMessage = enableAfterSessionMessage
            ? interaction.options.getString(`message`, true)
            : "";

        await this.serverMap.get(serverId)?.setAfterSessionMessage(newAfterSessionMessage);
        return `Successfully updated after session message.`;
    }

    /**
     * Checks if the command came from a server with correctly initialized YABOB
     * Each handler will have their own isServerInteraction method
     * ----
     * @returns string: the server id
    */
    private async isServerInteraction(
        interaction: CommandInteraction
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
}

export { CentralCommandDispatcher };