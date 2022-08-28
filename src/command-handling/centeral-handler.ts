import {
    CategoryChannel,
    CommandInteraction,
    GuildMember,
    TextChannel
} from "discord.js";
import { AttendingServerV2, QueueChannel } from "../attending-server/base-attending-server";
import { EmbedColor, SimpleEmbed, ErrorEmbed } from "../utils/embed-helper";
import { CommandParseError, UserViewableError } from '../utils/error-types';

/**
const handlers = new Map<string, CommandHandler>([
    ["queue", new QueueCommandHandler()],
    ["enqueue", new EnqueueCommandHandler()],
    ["next", new DequeueCommandHandler()],
    ["start", new StartCommandHandler()],
    ["stop", new StopCommandHandler()],
    ["leave", new LeaveCommandHandler()],
    ["clear", new ClearCommandHandler()],
    ["announce", new AnnounceCommandHandler()],
    ["list_helpers", new ListHelpersCommandHandler()],
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
*/
class CentralCommandDispatcher {
    private readonly commandMethodMap = new Map([
        ['queue', (interaction: CommandInteraction) => this.queue(interaction)],
        ['enqueue', (interaction: CommandInteraction) => this.enqueue(interaction)],
        ['next', (interaction: CommandInteraction) => this.next(interaction)],
        ['start', (interaction: CommandInteraction) => this.start(interaction)],
        ['stop', (interaction: CommandInteraction) => this.stop(interaction)],
        ['leave', (interaction: CommandInteraction) => this.leave(interaction)],
        ['clear', (interaction: CommandInteraction) => this.clear(interaction)]
    ]);

    constructor(
        private serverMap: Map<string, AttendingServerV2>,
    ) { }

    async process(interaction: CommandInteraction): Promise<void> {
        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (commandMethod !== undefined) {
            console.log(`User ${interaction.user.username} used ${interaction.toString()}`);
            await interaction.reply({
                ...SimpleEmbed(
                    'Processing…',
                    EmbedColor.Neutral
                ),
                ephemeral: true
            });
            await commandMethod(interaction)
                .then(async () =>
                    await interaction.editReply(
                        SimpleEmbed(
                            `Command \`/${interaction.commandName}\` `
                            + `finished successfully.`,
                            EmbedColor.Success),
                    ))
                .catch(async (err: UserViewableError) =>
                    await interaction.editReply(
                        ErrorEmbed(err)
                    )); // Central error handling, reply to user with the error
        } else {
            await interaction.editReply(
                ErrorEmbed(new CommandParseError(
                    'This command does not exist.'
                )));
        }
    }

    private async queue(interaction: CommandInteraction): Promise<void> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithRoles(
                interaction,
                `queue ${interaction.options.getSubcommand()}`,
                ['Admin', 'Staff'])
        ]);

        // start parsing
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case "add": {
                const queueName = interaction.options.getString("queue_name", true);
                await this.serverMap.get(serverId)
                    ?.createQueue(queueName);
                break;
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
                break;
            }
            default: {
                return Promise.reject(new CommandParseError(
                    `Invalid queue creation subcommand ${subcommand}.`));
            }
        }
    }

    private async enqueue(interaction: CommandInteraction): Promise<void> {
        const [serverId, queueChannel] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isValidQueueInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(interaction, "enqueue"),
        ]);

        // type is already checked, so we can safely cast
        await this.serverMap.get(serverId)
            ?.enqueueStudent(interaction.member as GuildMember, queueChannel);
    }

    private async next(interaction: CommandInteraction): Promise<void> {
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

        await this.serverMap.get(serverId)?.dequeueFirst(member);
    }

    private async start(interaction: CommandInteraction): Promise<void> {
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
    }

    private async stop(interaction: CommandInteraction): Promise<void> {
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

        await this.serverMap.get(serverId)?.closeAllClosableQueues(member);
    }

    private async leave(interaction: CommandInteraction): Promise<void> {
        const [serverId, member, queue] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(
                interaction,
                "leave"
            ),
            this.isValidQueueInteraction(interaction)
        ]);

        await this.serverMap.get(serverId)?.removeStudentFromQueue(member, queue);
    }

    private async clear(interaction: CommandInteraction): Promise<void> {
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
    }

    /**
     * Below are the validation functions
     * - Returns type is Promise<validatedValueType> 
     * - return Promise.reject if something fails
     * - return a value if needed
     * Usage Example:
     * - const [serverId] = await Promise.all([
     *      this.isServerInteraction(interaction),
     *      this.isTriggeredByStaffOrAdmin(
     *          interaction,
                `queue ${interaction.options.getSubcommand()}`)
        ]);
        - use const [valueName, ...] = await Promise.all() to pick the ones you need
        - Place the non void promises at the front for cleaner syntax
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
                `You need to be a staff member to use \`/${commandName}\`.`));
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