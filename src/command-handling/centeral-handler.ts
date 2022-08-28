import {
    CategoryChannel,
    CommandInteraction,
    GuildMember,
    TextChannel
} from "discord.js";
import { AttendingServerV2, QueueChannel } from "../attending-server/base-attending-server";
import { EmbedColor, SimpleEmbed, ErrorEmbed } from "../utils/embed-helper";
import {
    CommandNotImplementedError,
    CommandParseError, UserViewableError
} from '../utils/error-types';

/**
 * TODO
 * 
 * const handlers = new Map<string, CommandHandler>([
    ["announce", new AnnounceCommandHandler()],
    ["notify_me", new GetNotifcationsHandler()],
    ["remove_notif", new RemoveNotifcationsHandler()],
    ["post_session_msg", new MsgAfterLeaveVCHandler()],
]);
**/

/**
 * Responsible for preprocessing commands and dispatching them to servers
 * ----
 * - Each YABOB instance should only have 1 central command dispatcher
 * - All the functions in this class follow these conventions:
 *   - function names are the corresponding command names
 *   - Each function will: 
 *     1. check if server exist
 *     2. do command specific checks
 *     3. call server command handler
 *     4. explicitly reject if parsing failed
 *     5. return reply message
*/
class CentralCommandDispatcher {
    private readonly commandMethodMap = new Map([
        ['queue', (interaction: CommandInteraction) => this.queue(interaction)],
        ['enqueue', (interaction: CommandInteraction) => this.enqueue(interaction)],
        ['next', (interaction: CommandInteraction) => this.next(interaction)],
        ['start', (interaction: CommandInteraction) => this.start(interaction)],
        ['stop', (interaction: CommandInteraction) => this.stop(interaction)],
        ['leave', (interaction: CommandInteraction) => this.leave(interaction)],
        ['clear', (interaction: CommandInteraction) => this.clear(interaction)],
        ['list_helpers', (interaction: CommandInteraction) => this.listHelpers(interaction)]
    ]);

    constructor(
        private serverMap: Map<string, AttendingServerV2>,
    ) { }

    async process(interaction: CommandInteraction): Promise<void> {
        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (commandMethod !== undefined) {
            await interaction.reply({
                ...SimpleEmbed(
                    'Processing command...',
                    EmbedColor.Neutral
                ),
                ephemeral: true
            });
            console.log(`User ${interaction.user.username} used ${interaction.toString()}`);
            await commandMethod(interaction as CommandInteraction)
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
            await interaction.reply({
                    ...ErrorEmbed(new CommandNotImplementedError(
                        'This command does not exist.'
                    )),
                    ephemeral: true
                });
        }
    }

    private async queue(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithRoles(
                interaction,
                `queue ${interaction.options.getSubcommand()}`,
                ['Admin'])
        ]);

        // start parsing
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case "add": {
                const queueName = interaction.options.getString("queue_name", true);
                await this.serverMap.get(serverId)
                    ?.createQueue(queueName);
                return `Successfully created \`${queueName}\``;
            }
            case "remove": {
                await this.isValidQueueInteraction(interaction);
                const channel = interaction.options.getChannel("queue_name", true);
                if (channel.type !== 'GUILD_CATEGORY') {
                    return Promise.reject(
                        new CommandParseError(
                            `${channel.name.toUpperCase()} is not a category channel.`));
                }
                await this.serverMap.get(serverId)
                    ?.deleteQueueById(channel.id);
                return `Successfully deleted \`${channel.name}\``;
            }
            default: {
                return Promise.reject(new CommandParseError(
                    `Invalid queue creation subcommand ${subcommand}.`));
            }
        }
    }

    private async enqueue(interaction: CommandInteraction): Promise<string> {
        const [serverId, queueChannel, member] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isValidQueueInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(interaction, "enqueue"),
        ]);

        // type is already checked, so we can safely cast
        await this.serverMap.get(serverId)
            ?.enqueueStudent(member, queueChannel);
        return `Successfully joined \`${queueChannel.queueName}\`.`;
    }

    private async next(interaction: CommandInteraction): Promise<string> {
        const [serverId, , member] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(
                interaction,
                "next"
            ),
            this.isTriggeredByUserWithRoles(
                interaction,
                "next",
                ['Admin', 'Staff'])
        ]);
        const student = await this.serverMap.get(serverId)?.dequeueFirst(member);
        return `An invite has been sent to ${student?.member.displayName}.`;
    }

    private async start(interaction: CommandInteraction): Promise<string> {
        const [serverId, member] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithRoles(
                interaction,
                "start",
                ['Admin', 'Staff']),
            this.isTriggeredByUserWithValidEmail(
                interaction,
                "start"
            ),
        ]);
        await this.serverMap.get(serverId)?.openAllOpenableQueues(member);
        return `You have started helping! Have Fun!`;
    }

    private async stop(interaction: CommandInteraction): Promise<string> {
        const [serverId, member] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithRoles(
                interaction,
                "start",
                ['Admin', 'Staff']),
            this.isTriggeredByUserWithValidEmail(
                interaction,
                "start"
            ),
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
            this.isTriggeredByUserWithValidEmail(
                interaction,
                "leave"
            ),
            this.isValidQueueInteraction(interaction)
        ]);

        await this.serverMap.get(serverId)?.removeStudentFromQueue(member, queue);
        return `You have successfully left from queue ${queue.queueName}.`;
    }

    private async clear(interaction: CommandInteraction): Promise<string> {
        const [serverId, queue] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isValidQueueInteraction(interaction),
            this.isTriggeredByUserWithRoles(
                interaction,
                "clear",
                ['Admin', 'Staff']
            ),
            this.isTriggeredByUserWithValidEmail(
                interaction,
                "clear"
            ),
        ]);

        await this.serverMap.get(serverId)?.clearQueue(queue);
        return `Everyone in  queue ${queue.queueName} was removed.`;
    }

    private async listHelpers(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction)
        ]);
        const helpers = this.serverMap.get(serverId ?? '')?.getAllHelpers();
        if (helpers === undefined || helpers.size === 0) {
            return `No one is currently helping.`;
        }
        return `[${[...helpers].join('\n')}]\n${helpers.size === 1 ? 'is' : 'are'} helping`;
    }

    /**
     * Below are the validation functions
     * - Returns type is Promise<validatedValueType> 
     * - return Promise.reject if something fails
     * - return a value if needed
     * 
     * Usage Example:
     * - const [serverId] = await Promise.all([
     *      this.isServerInteraction(...),
     *      this.isTriggeredByStaffOrAdmin(...)
     * ]);
     * - Place the non void promises at the front for cleaner syntax
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

    private async isTriggeredByUserWithRoles(
        interaction: CommandInteraction,
        commandName: string,
        requiredRoles: string[]
    ): Promise<GuildMember> {
        const userRoles = (await (interaction.member as GuildMember)?.fetch())
            .roles.cache.map(role => role.name);
        if (!(interaction.member instanceof GuildMember &&
            (userRoles.some(role => requiredRoles.includes(role))))) {
            return Promise.reject(new CommandParseError(
                `You need to be ${requiredRoles.join(' or ')} to use \`/${commandName}\`.`));
        }
        return interaction.member as GuildMember;
    }

    private async isTriggeredByUserWithValidEmail(
        interaction: CommandInteraction,
        commandName: string
    ): Promise<GuildMember> {
        const roles = (await (interaction.member as GuildMember)?.fetch())
            .roles.cache.map(role => role.name);
        if (!(interaction.member instanceof GuildMember &&
            roles.includes('Verified Email'))) {
            return Promise.reject(new CommandParseError(
                `You need to have a verified email to use \`/${commandName}\`.`));
        }
        return interaction.member as GuildMember;
    }

    /**
     * Checks if the REQUIRED queue_name argument is valid
     * */
    private async isValidQueueInteraction(
        interaction: CommandInteraction
    ): Promise<QueueChannel> {
        const channel = interaction.options.getChannel("queue_name", true);
        if (channel.type !== 'GUILD_CATEGORY') {
            return Promise.reject(new CommandParseError(
                `${channel.name} is not a valid queue category.`));
        }
        const queueTextChannel = (channel as CategoryChannel).children
            .find(child =>
                child.name === 'queue' &&
                child.type === 'GUILD_TEXT');
        if (queueTextChannel === undefined) {
            return Promise.reject(new CommandParseError(
                `This category does not have a \`#queue\` text channel.\n` +
                `If you are an admin, you can use \`/queue add ${channel.name}\` ` +
                `to generate one.`));
        }
        const queueChannel: QueueChannel = {
            channelObj: queueTextChannel as TextChannel,
            queueName: channel.name
        };
        return queueChannel;
    }
}

export { CentralCommandDispatcher };