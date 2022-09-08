import { CommandInteraction, GuildChannel, GuildMemberRoleManager } from "discord.js";
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
import { msToHourMins } from '../utils/util-functions';
// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';

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
    // undefined return values is when the method wants to reply to the interaction directly
    // - If a call returns undefined, processCommand won't edit the reply
    public commandMethodMap: ReadonlyMap<
        string,
        (interaction: CommandInteraction) => Promise<string | undefined>
    > = new Map<string, (interaction: CommandInteraction) => Promise<string | undefined>>([
        ['announce', (interaction: CommandInteraction) => this.announce(interaction)],
        ['cleanup', (interaction: CommandInteraction) => this.cleanup(interaction)],
        ['cleanup_help_ch', (interaction: CommandInteraction) => this.cleanupHelpChannel(interaction)],
        ['clear', (interaction: CommandInteraction) => this.clear(interaction)],
        ['clear_all', (interaction: CommandInteraction) => this.clearAll(interaction)],
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
                // shorthand syntax, if successMsg is undefined, don't run the rhs
                .then(async successMsg => successMsg &&
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
        return `You helped for ` +
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            msToHourMins(helpTime!.helpEnd.getTime() - helpTime!.helpStart.getTime()) +
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
        // casting is safe because we checked for isServerInteraction
        const memberRoles = interaction.member?.roles as GuildMemberRoleManager;
        // if they are not admin or doesn't have the queue role, reject
        if (
            memberRoles.cache.find(role =>
                role.name === queue.queueName ||
                role.name === 'Bot Admin'
            ) === undefined
        ) {
            return Promise.reject(new CommandParseError(
                `You don't have permission to clear '${queue.queueName}'. ` +
                `You can only clear the queues that you have a role of.`
            ));
        }
        await this.serverMap.get(serverId)?.clearQueue(queue);
        return `Everyone in  queue ${queue.queueName} was removed.`;
    }

    private async clearAll(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                "clear_all",
                ['Bot Admin']
            )
        ]);
        const server = this.serverMap.get(serverId);
        const allQueues = await server?.getQueueChannels();
        if (allQueues === undefined) {
            return Promise.reject(new CommandParseError(
                `This server doesn't seem to have any queues. ` +
                `You can use \`/queue add <name>\` to create one`
            ));
        }
        await Promise.all(allQueues.map(queue => server?.clearQueue(queue)));
        return `All queues on ${server?.guild.name} was cleard.`;
    }

    private async listHelpers(interaction: CommandInteraction): Promise<undefined> {
        const serverId = await this.isServerInteraction(interaction);
        const helpers = this.serverMap.get(serverId)?.helpers;
        if (helpers === undefined || helpers.length === 0) {
            await interaction.editReply(SimpleEmbed('No one is currently helping.'));
            return undefined;
        }
        const table = new AsciiTable3();
        const allQueues = await this.serverMap.get(serverId)?.getQueueChannels() ?? [];
        table.setHeading('Tutor name', 'Availbale Queues', 'Time Elapsed')
            .setAlign(1, AlignmentEnum.CENTER)
            .setAlign(2, AlignmentEnum.CENTER)
            .setAlign(3, AlignmentEnum.CENTER)
            .setStyle('unicode-mix')
            .addRowMatrix(helpers
                .map(helper => [
                    helper.member.displayName,
                    ((helper.member.roles as GuildMemberRoleManager)
                        .cache
                        .filter(role => allQueues
                            .find(queue => queue.queueName === role.name) !== undefined)
                        .map(role => role.name).toString()),
                    msToHourMins((new Date()).valueOf() - (helper.helpStart.valueOf()))
                ])
            )
            .setWidths([15, 20, 15])
            .setWrapped(1)
            .setWrapped(2)
            .setWrapped(3);

        await interaction.editReply(SimpleEmbed(
            'Current Helpers',
            EmbedColor.Aqua,
            '```' + table.toString() + '```'
        ));
        return undefined;
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