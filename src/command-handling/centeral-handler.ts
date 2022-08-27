import {
    CategoryChannel,
    CommandInteraction,
    Guild,
    GuildChannel,
    GuildMember,
    GuildMemberRoleManager,
    Interaction,
    TextChannel,
    User
} from "discord.js";
import { QueueChannel } from "../attending-server/base-attending-server";
import { EmbedColor, SimpleEmbed } from "../utils/embed-heper";
import { ServerCommandHandler } from "./server-handler";
import { CommandError, ServerError } from '../utils/error-types';

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
 * Responsible for validating & parsing commands, then dispatching them to servers
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
    private constructor(private serverHandlerMap: Map<string, ServerCommandHandler>) { }
    private static instance?: CentralCommandDispatcher;

    static create(serverHandlerMap: Map<string, ServerCommandHandler>): CentralCommandDispatcher {
        if (this.instance === undefined) {
            this.instance = new CentralCommandDispatcher(serverHandlerMap);
        }
        return this.instance;
    }

    static getInstance(): CentralCommandDispatcher {
        if (this.instance === undefined) {
            throw Error('Dispatcher not created');
        }
        return this.instance;
    }

    async queue(interaction: CommandInteraction): Promise<void> {
        const serverId = interaction.guild?.id;

        if (!serverId || !this.serverHandlerMap.has(serverId)) {
            throw new CommandError('I only accept server based interactions');
        }
        // start parsing
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case "add": {
                const queueName = interaction.options.getString("queue_name", true);
                await this.serverHandlerMap.get(serverId)
                    ?.createQueue(queueName)
                    .then(() => interaction.editReply(SimpleEmbed(
                        `Successfully created queue "${queueName}"`,
                        EmbedColor.Success)))
                    .catch((err: ServerError) => {
                        throw err;
                    });
                break;
            }
            case "remove": {
                const channel = interaction.options.getChannel("queue_name", true);
                if (channel.type !== 'GUILD_TEXT') {
                    throw new CommandError('The channel is not a text channel');
                }
                this.serverHandlerMap.get(serverId)
                    ?.deleteQueue(channel as TextChannel)
                    .then(() => interaction.editReply(SimpleEmbed(
                        `Successfully removed queue "${channel.name}"`,
                        EmbedColor.Success)))
                    .catch((err: ServerError) => {
                        throw err;
                    });
                break;
            }
            default: {
                throw new CommandError('Invalid queue creation command.');
            }
        }
    }

    async enqueue(interaction: CommandInteraction): Promise<void> {
        const channel = interaction.options.getChannel("queue_name", true);
        const serverId = interaction.guild?.id;

        if (!serverId || !this.serverHandlerMap.has(serverId)) {
            throw new CommandError('I only accept server based interactions');
        }
        if (channel.type !== 'GUILD_CATEGORY') {
            throw new CommandError(`${channel.name} is not a valid queue`);
        }
        if (interaction.member instanceof GuildMember &&
            !interaction.member.roles.cache.has('Verified Email')) {
            throw new CommandError(`You need to be verified to use /enqueue.`);
        }

        const queueTextChannel = (channel as CategoryChannel).children
            .find(child =>
                child.name === 'queue' &&
                child.type === 'GUILD_TEXT');

        if (queueTextChannel === undefined) {
            throw new CommandError(
                `This category does not have a 'queue' text channel. `
                + `Consider using /queue < ${channel.name} > to generate one`);
        }

        const queueChannel: QueueChannel = {
            channelObject: queueTextChannel as TextChannel,
            queueName: channel.name
        };

        // type is already checked, so we can safely cast
        await this.serverHandlerMap
            .get(serverId)
            ?.enqueue(interaction.member as GuildMember, queueChannel)
            .then(() => interaction.editReply(
                SimpleEmbed(`Successfully joined queue "${channel.name}"`,
                    EmbedColor.Success))
            )
            .catch((err: ServerError) => {
                throw err;
            });
    }


}

export { CentralCommandDispatcher as CentralCommandHandler };