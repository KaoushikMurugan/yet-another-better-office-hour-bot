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
import { EmbedColor, SimpleEmbed } from "../embed_helper";
import { ServerCommandHandler, ServerError } from "./server-handler";
import { BaseBOBCommands, postSlashCommands } from './slash-commands';

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

class CommandError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CommandError";
    }
}

/**
 * Responsible for validating & parsing commands, then dispatch them to servers
 * Each YABOB instance should only have 1 central command handler
*/
class CentralCommandDispatcher {
    // constructor(private readonly server: )
    constructor(private serverHandlerMap: Map<string, ServerCommandHandler>) { }

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
        console.log(channel.name);

        return;
        const serverId = interaction.guild?.id;

        if (!serverId || !this.serverHandlerMap.has(serverId)) {
            throw new CommandError('I only accept server based interactions');
        }
        if (channel.type !== 'GUILD_TEXT') {
            throw new CommandError(`enqueue command cannot be invoked here.`);
        }
        if (interaction.member instanceof GuildMember &&
            !interaction.member.roles.cache.has('Verified Email')) {
            throw new CommandError(`You need to be verified to use /enqueue.`);
        }

        const queueChannel: QueueChannel = {
            channelObject: channel,
            queueName: channel.name
        };

        // type is already checked, so we can safely cast
        await this.serverHandlerMap
            .get(serverId)
            ?.enqueue(interaction.member as GuildMember, queueChannel)
            .then(() => interaction.editReply(
                SimpleEmbed(`Successfully joined queue "${channel.name}"`,
                    EmbedColor.Success))
            );



    }


}

export { CentralCommandDispatcher as CentralCommandHandler };