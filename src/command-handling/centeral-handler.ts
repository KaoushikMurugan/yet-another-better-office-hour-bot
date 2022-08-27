import {
    CategoryChannel,
    CommandInteraction,
    GuildMember,
    TextChannel
} from "discord.js";
import { AttendingServerV2, QueueChannel } from "../attending-server/base-attending-server";
import { EmbedColor, SimpleEmbed } from "../utils/embed-helper";
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
    ["when_next", new ListNextHoursCommandHandler()],
    ["notify_me", new GetNotifcationsHandler()],
    ["remove_notif", new RemoveNotifcationsHandler()],
    ["post_session_msg", new MsgAfterLeaveVCHandler()],
    ["calendar", new SetCalendarHandler()],
    ["force_update_queues", new ForceUpdateQueues()],
]);
**/

/**
 * Responsible for preprocessing commands and dispatching them to servers
 * ----
 * Notes:
 * - This is a singleton class
 * - All the functions in this class follow these conventions:
 *   - function names are the corresponding command names
 *   - each function will: 
 *     1. check if server exist
 *     2. do command specific checks
 *     3. call server command handler
 *     4. resolve / reject
*/

class CentralCommandDispatcher {
    private readonly commandMethodMap = new Map([
        ['queue', (interaction: CommandInteraction) => this.queue(interaction)],
        ['enqueue', (interaction: CommandInteraction) => this.enqueue(interaction)],
    ]);

    constructor(
        private serverMap: Map<string, AttendingServerV2>,
    ) { }

    async process(interaction: CommandInteraction): Promise<void> {
        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (commandMethod !== undefined) {
            console.log(`Attempting ${interaction.toString()}`);
            await commandMethod(interaction)
                .then(async () =>
                    await interaction.reply({
                        ...SimpleEmbed(
                            `Command \`/${interaction.commandName} `
                            + `${interaction.options.getSubcommand() ?? ''}\``
                            + ` finished successfully.`,
                            EmbedColor.Success),
                        ephemeral: true
                    }))
                .catch(async (err: UserViewableError) =>
                    await interaction.reply({
                        ...SimpleEmbed(
                            err.briefErrorString(),
                            EmbedColor.Error,
                            `If you need help or think this is a mistake, `
                            + `please post a screenshot of this message in the #help channel `
                            + `and ping the Officers.`
                        ),
                        ephemeral: true
                    }));
        }
    }

    private async queue(interaction: CommandInteraction): Promise<void> {
        const serverId = interaction.guild?.id;
        if (!serverId || !this.serverMap.has(serverId)) {
            return Promise.reject(
                new CommandParseError('I only accept server based interactions.')
            );
        }
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
                const channel = interaction.options.getChannel("queue_name", true);
                if (channel.type !== 'GUILD_CATEGORY') {
                    return Promise.reject(
                        new CommandParseError(
                            `${channel.name.toUpperCase()} is not a category channel.`)
                    );
                }
                await this.serverMap.get(serverId)
                    ?.deleteQueueByID(channel.id);
                break;
            }
            default: {
                return Promise.reject(new CommandParseError(
                    `Invalid queue creation subcommand ${subcommand}.`));
            }
        }
    }

    private async enqueue(interaction: CommandInteraction): Promise<void> {
        const serverId = interaction.guild?.id;
        if (!serverId || !this.serverMap.has(serverId)) {
            return Promise.reject(new CommandParseError(
                'I only accept server based interactions'));
        }

        const channel = interaction.options.getChannel("queue_name", true);
        if (channel.type !== 'GUILD_CATEGORY') {
            return Promise.reject(new CommandParseError(
                `${channel.name} is not a valid queue.`));
        }

        const roles = (await (interaction.member as GuildMember)?.fetch())
            .roles.cache.map(role => role.name);
        if (!(interaction.member instanceof GuildMember &&
            roles.includes('Verified Email'))) {
            return Promise.reject(new CommandParseError(
                `You need to be verified to use \`/enqueue.\``));
        }

        const queueTextChannel = (channel as CategoryChannel).children
            .find(child =>
                child.name === 'queue' &&
                child.type === 'GUILD_TEXT');
        if (queueTextChannel === undefined) {
            return Promise.reject(new CommandParseError(
                `This category does not have a \`#queue\` text channel. `
                + `Consider using \`/queue add ${channel.name}\` to generate one.`));
        }

        const queueChannel: QueueChannel = {
            channelObj: queueTextChannel as TextChannel,
            queueName: channel.name
        };

        // type is already checked, so we can safely cast
        await this.serverMap
            .get(serverId)
            ?.enqueueStudent(interaction.member as GuildMember, queueChannel);
    }

    private async next(interaction: CommandInteraction): Promise<void> {

        return Promise.resolve();
    }
}

export { CentralCommandDispatcher };