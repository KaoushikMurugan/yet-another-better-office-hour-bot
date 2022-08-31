import {
    CommandInteraction,
    GuildChannel,
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
    private readonly commandMethodMap = new Map([
        ['queue', (interaction: CommandInteraction) => this.queue(interaction)],
        ['enqueue', (interaction: CommandInteraction) => this.enqueue(interaction)],
        ['next', (interaction: CommandInteraction) => this.next(interaction)],
        ['start', (interaction: CommandInteraction) => this.start(interaction)],
        ['stop', (interaction: CommandInteraction) => this.stop(interaction)],
        ['leave', (interaction: CommandInteraction) => this.leave(interaction)],
        ['clear', (interaction: CommandInteraction) => this.clear(interaction)],
        ['list_helpers', (interaction: CommandInteraction) => this.listHelpers(interaction)],
        ['announce', (interaction: CommandInteraction) => this.announce(interaction)],
        ['cleanup', (interaction: CommandInteraction) => this.cleanup(interaction)]
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
            console.log(`[${(new Date).toLocaleString()}]` +
                ` User ${interaction.user.username} used ${interaction.toString()}`);
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
            this.isTriggeredByUserWithRoles(
                interaction,
                `queue ${interaction.options.getSubcommand()}`,
                ['Admin'])
        ]);

        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case "add": {
                const queueName = interaction.options.getString("queue_name", true);
                await this.serverMap.get(serverId)
                    ?.createQueue(queueName);
                return `Successfully created \`${queueName}\``;
            }
            case "remove": {
                await this.isValidQueueInteraction(interaction, true);
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
                    `Invalid /queue subcommand ${subcommand}.`));
            }
        }
    }

    private async enqueue(interaction: CommandInteraction): Promise<string> {
        const [serverId, queueChannel, member] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isValidQueueInteraction(interaction),
            this.isTriggeredByUserWithValidEmail(interaction, "enqueue"),
        ]);

        await this.serverMap
            .get(serverId)
            ?.enqueueStudent(member, queueChannel);
        return `Successfully joined \`${queueChannel.queueName}\`.`;
    }

    private async next(interaction: CommandInteraction): Promise<string> {
        const [serverId, member] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithRoles(
                interaction,
                "next",
                ['Admin', 'Staff']),
            this.isTriggeredByUserWithValidEmail(
                interaction,
                "next"
            ),
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
        const muteNotif = interaction.options.getBoolean('mute_notif') ?? false;
        await this.serverMap.get(serverId)?.openAllOpenableQueues(member, !muteNotif);
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
            this.isValidQueueInteraction(interaction, true),
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
        const helpers = this.serverMap.get(serverId ?? '')?.helperNames;
        if (helpers === undefined || helpers.size === 0) {
            return `No one is currently helping.`;
        }
        return `[${[...helpers].join('\n')}]\n${helpers.size === 1 ? 'is' : 'are'} helping`;
    }

    private async announce(interaction: CommandInteraction): Promise<string> {
        const [serverId, member] = await Promise.all([
            this.isServerInteraction(interaction),
            this.isTriggeredByUserWithRoles(
                interaction,
                'announce',
                ['Admin', 'Staff']
            ),
            this.isTriggeredByUserWithValidEmail(
                interaction,
                'announce'
            ),
        ]);
        const announcement = interaction.options.getString("message", true);
        const optionalChannel = interaction.options.getChannel("queue_name", false);
        if (optionalChannel) {
            const queueChannel = await this.isValidQueueInteraction(interaction);
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
            this.isValidQueueInteraction(interaction, true),
            this.isTriggeredByUserWithRoles(
                interaction,
                'cleanup',
                ['Admin', 'Staff']
            ),
        ]);
        await this.serverMap.get(serverId)?.cleanUpQueue(queue);
        return `Queue ${queue.queueName} has been cleaned up.`;
    }

    /**
     * Below are the validation functions
     * - @returns Promise<validatedValueType> if the check passed
     * - @returns Promise.reject(new CommandParseError(errMsg)) if something fails
     * 
     * Usage Example:
     * - const [serverId] = await Promise.all([
     *      this.isServerInteraction(...),
     *      this.isTriggeredByStaffOrAdmin(...)
     * ]);
     * - Place the non void promises at the front for cleaner syntax
    */

    /**
     * Checks if the command came from a server with correctly initialized YABOB
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

    /**
     * Checks if the triggerer has all the required roles
     * ----
     * @param commandName the command used
     * @param requiredRoles the roles to check, roles have AND relationship
     * @returns GuildMember: object of the triggerer
    */
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
                `You need to have: [${requiredRoles.join(' or ')}] to use \`/${commandName}\`.`));
        }
        return interaction.member as GuildMember;
    }

    /**
     * Checks if the user has the Valid Email role
     * ----
     * @param commandName the command used
     * @returns GuildMember: object of the triggerer
    */
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
     * Checks if the queue_name argument is given
     * If not, use the parent of the channel where the command was used
     * ----
     * @returns QueueChannel: the complete QueueChannel that AttendingServerV2 accepts
     * */
    private async isValidQueueInteraction(
        interaction: CommandInteraction,
        required = false
    ): Promise<QueueChannel> {
        const parentCategory = interaction.options.getChannel("queue_name", required) ??
            (interaction.channel as GuildChannel).parent;
        // null check is done here by optional property access
        if (parentCategory?.type !== 'GUILD_CATEGORY' || parentCategory === null) {
            return Promise.reject(new CommandParseError(
                `\`${parentCategory?.name}\` is not a valid queue category.`));
        }
        const queueTextChannel = parentCategory.children
            .find(child =>
                child.name === 'queue' &&
                child.type === 'GUILD_TEXT');
        if (queueTextChannel === undefined) {
            return Promise.reject(new CommandParseError(
                `This category does not have a \`#queue\` text channel.\n` +
                `If you are an admin, you can use \`/queue add ${parentCategory.name}\` ` +
                `to generate one.`));
        }
        const queueChannel: QueueChannel = {
            channelObj: queueTextChannel as TextChannel,
            queueName: parentCategory.name,
            parentCategoryId: parentCategory.id
        };
        return queueChannel;
    }
}

export { CentralCommandDispatcher };