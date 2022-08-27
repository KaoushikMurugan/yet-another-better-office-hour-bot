import {
    ButtonInteraction,
    CategoryChannel,
    CommandInteraction,
    GuildMember,
    TextChannel
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
        private serverHandlerMap: Map<string, ServerCommandHandler>,
    ) { }

    async process(interaction: CommandInteraction): Promise<void> {
        let success = true;

        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (commandMethod !== undefined) {
            console.log(`attempt ${interaction.commandName}`);
            try {
                await commandMethod(interaction);
            }
            catch (err) {
                console.error(err);
                success = false;
            }
        }

        return new Promise<void>((resolve, reject) => success
            ? resolve()
            // todo: add better error message
            : reject(new CommandError('Command Failed'))
        );

    }

    private async queue(interaction: CommandInteraction): Promise<void> {
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
                    .then(() => interaction.reply({
                        ...SimpleEmbed(
                            `Successfully removed queue "${queueName}"`,
                            EmbedColor.Success),
                        ephemeral: true
                    }))
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
                    .then(() => interaction.reply({
                        ...SimpleEmbed(
                            `Successfully removed queue "${channel.name}"`,
                            EmbedColor.Success),
                        ephemeral: true
                    }))
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

    private async enqueue(interaction: CommandInteraction): Promise<void> {
        const channel = interaction.options.getChannel("queue_name", true);
        const serverId = interaction.guild?.id;
        if (!serverId || !this.serverHandlerMap.has(serverId)) {
            throw new CommandError('I only accept server based interactions');
        }
        if (channel.type !== 'GUILD_CATEGORY') {
            throw new CommandError(`${channel.name} is not a valid queue`);
        }

        const roles = (await (interaction.member as GuildMember)?.fetch())
            .roles.cache.map(role => role.name);
        if (!(interaction.member instanceof GuildMember &&
            roles.includes('Verified Email'))) {
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
            .then(async () => {
                console.log('then');
                await interaction.reply({
                    ...SimpleEmbed(
                        `Successfully joined queue "${channel.name}"`,
                        EmbedColor.Success),
                    ephemeral: true
                });
            })
            .catch((err: ServerError) => {
                console.log('catch');
                throw err;
            });
    }
}

export { CentralCommandDispatcher as CentralCommandHandler };