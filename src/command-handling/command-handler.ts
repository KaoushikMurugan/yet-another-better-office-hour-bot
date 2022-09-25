import { CommandInteraction, GuildChannel, GuildMember, GuildMemberRoleManager, TextChannel } from "discord.js";
import { AttendingServerV2 } from "../attending-server/base-attending-server";
import { FgCyan, FgYellow, ResetColor } from "../utils/command-line-colors";
import { EmbedColor, SimpleEmbed, ErrorEmbed, SlashCommandLogEmbed, ErrorLogEmbed } from "../utils/embed-helper";
import {
    CommandNotImplementedError,
    CommandParseError, UserViewableError
} from '../utils/error-types';
import {
    isTriggeredByUserWithRoles,
    hasValidQueueArgument,
    isFromGuildMember,
    logEditFailure
} from './common-validations';
import { convertMsToTime } from '../utils/util-functions';
// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { GuildId } from "../utils/type-aliases";
import { adminCommandHelpMessages } from "../../help-channel-messages/AdminCommands";
import { helperCommandHelpMessages } from "../../help-channel-messages/HelperCommands";
import { studentCommandHelpMessages } from "../../help-channel-messages/StudentCommands";

/**
 * Responsible for preprocessing commands and dispatching them to servers
 * ----
 * - Each YABOB instance should only have 1 central command dispatcher
 * All the functions below follows this convention:
 *      private async <corresponding command name>(interaction): Promise<string>
 * @param interaction the raw interaction
 * @throws CommandParseError: if command doesn't satify the checks in Promise.all
 * @throws QueueError or ServerError: if the target HelpQueueV2 or AttendingServer rejects
 * @returns 
 * - string: the success message
 * - undefined: if the function already replied
 */
class CentralCommandDispatcher {

    // The map of available commands
    // Key is what the user will see, value is the arrow function
    // - arrow function wrapper is required because of the closure of 'this'
    // undefined return values is when the method wants to reply to the interaction directly
    // - If a call returns undefined, processCommand won't edit the reply
    commandMethodMap: ReadonlyMap<
        string,
        (interaction: CommandInteraction) => Promise<string | undefined>
    > = new Map<string, (interaction: CommandInteraction) => Promise<string | undefined>>([
        ['announce', (interaction: CommandInteraction) => this.announce(interaction)],
        ['cleanup_queue', (interaction: CommandInteraction) => this.cleanup(interaction)],
        ['cleanup_all', (interaction: CommandInteraction) => this.cleanupAllQueues(interaction)],
        ['cleanup_help_channels', (interaction: CommandInteraction) => this.cleanupHelpChannel(interaction)],
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
        ['help', (interaction: CommandInteraction) => this.help(interaction)],
        ['set_logging_channel', (interaction: CommandInteraction) => this.setLoggingChannel(interaction)],
        ['stop_logging', (interaction: CommandInteraction) => this.stopLogging(interaction)],
        ['set_queue_auto_clear', (interaction: CommandInteraction) => this.setQueueAutoClear(interaction)]
    ]);

    // key is Guild.id, same as servers map from app.ts
    constructor(public serverMap: Map<GuildId, AttendingServerV2>) { }

    /**
     * Main processor for command interactions
     * ----
     * @param interaction the raw interaction from discord js
     * @throws UserViewableError: when the command exists but failed
     * @throws CommandNotImplementedError: if the command is not implemented
     * - If thrown but the command is implemented, make sure commandMethodMap has it
    */
    async process(interaction: CommandInteraction): Promise<void> {
        const serverId = await this.isServerInteraction(interaction) ?? 'unknown';
        this.serverMap.get(serverId)?.sendLogMessage(SlashCommandLogEmbed(interaction));
        // Immediately replay to show that YABOB has received the interaction
        await interaction.editReply({
            ...SimpleEmbed(
                'Processing command...',
                EmbedColor.Neutral
            )
        }).catch(logEditFailure);
        // Check the hashmap to see if the command exists as a key
        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (commandMethod !== undefined) {
            console.log(
                `[${FgCyan}${(new Date).toLocaleString('us-PT')}${ResetColor}] ` +
                `[${FgYellow}${interaction.guild?.name}, ${interaction.guildId}${ResetColor}] ` +
                `User ${interaction.user.username} ` +
                `(${interaction.user.id}) ` +
                `used ${interaction.toString()}`
            );
            await commandMethod(interaction)
                // shorthand syntax, if successMsg is undefined, don't run the rhs
                .then(async successMsg => successMsg &&
                    await interaction.editReply(
                        SimpleEmbed(successMsg, EmbedColor.Success)
                    ).catch(logEditFailure)
                ).catch(async (err: UserViewableError) => {
                    // Central error handling, reply to user with the error
                    await interaction.editReply(
                        ErrorEmbed(err)
                    ).catch(logEditFailure);
                    this.serverMap.get(serverId)?.sendLogMessage(ErrorLogEmbed(err, interaction));
                });
        } else {
            await interaction.editReply(ErrorEmbed(
                new CommandNotImplementedError('This command does not exist.')
            )).catch(logEditFailure);
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
        const [serverId, helperMember] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                "next",
                ['Bot Admin', 'Staff'])
        ]);
        const targetQueue = interaction.options.getChannel('queue_name', false) === null
            ? undefined
            : await hasValidQueueArgument(interaction, true);
        const targetStudent = interaction.options.getMember('user', false) === null
            ? undefined
            : interaction.options.getMember('user', true) as GuildMember;
        // if either target queue or target student is specified, use dequeueWithArgs
        // otherwise use dequeueGlobalFirst
        const dequeuedStudent = targetQueue || targetStudent
            ? await this.serverMap
                .get(serverId)
                ?.dequeueWithArgs(helperMember, targetStudent, targetQueue)
            : await this.serverMap
                .get(serverId)
                ?.dequeueGlobalFirst(helperMember);
        return `An invite has been sent to ${dequeuedStudent?.member.displayName}.`;
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
        return `You have started helping! Have fun!`;
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
            convertMsToTime(helpTime!.helpEnd.getTime() - helpTime!.helpStart.getTime()) +
            `. See you later!`;
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
        if (!memberRoles.cache
            .some(role =>
                role.name === queue.queueName ||
                role.name === 'Bot Admin')
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
        if (allQueues === undefined || allQueues.length === 0) {
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
        if (helpers === undefined || helpers.size === 0) {
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
            .addRowMatrix([...helpers.values()]
                .map(helper => [
                    helper.member.displayName,
                    ((helper.member.roles as GuildMemberRoleManager)
                        .cache
                        .filter(role => allQueues
                            .find(queue => queue.queueName === role.name) !== undefined)
                        .map(role => role.name).toString()),
                    convertMsToTime((new Date()).valueOf() - (helper.helpStart.valueOf()))
                ])
            )
            .setWidths([15, 15, 15])
            .setWrapped(1)
            .setWrapped(2)
            .setWrapped(3);

        await interaction.editReply(SimpleEmbed(
            'Current Helpers',
            EmbedColor.Aqua,
            '```' + table.toString() + '```'
        )).catch(() => console.error(`Edit reply failed with ${interaction.toJSON()}`));
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
        if (optionalChannel !== null) {
            const queueChannel = await hasValidQueueArgument(interaction, true);
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
        if ((interaction.channel as GuildChannel)?.name === 'queue') {
            return Promise.reject(new CommandParseError(
                'Please use this command outside the queue.'
            ));
        }
        await this.serverMap.get(serverId)?.cleanUpQueue(queue);
        return `Queue ${queue.queueName} has been cleaned up.`;
    }

    private async cleanupAllQueues(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                'cleanup',
                ['Bot Admin']
            ),
        ]);
        // no idea why, it will always throw Unknown message error if used in a queue
        if ((interaction.channel as GuildChannel)?.name === 'queue') {
            return Promise.reject(new CommandParseError(
                'Please use this command outside the queue.'
            ));
        }
        await Promise.all(
            (await this.serverMap.get(serverId)?.getQueueChannels())
                ?.map(queueChannel => this.serverMap.get(serverId)
                    ?.cleanUpQueue(queueChannel)) as Promise<void>[]
        );
        return `All queues have been cleaned up.`;
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

    private async setAfterSessionMessage(interaction: CommandInteraction): Promise<string> {
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

    private async help(interaction: CommandInteraction): Promise<undefined> {
        const commandName = interaction.options.getString('command', true);
        const helpMessage = adminCommandHelpMessages.find(message => message.nameValuePair[1] === commandName)
            ?? helperCommandHelpMessages.find(message => message.nameValuePair[1] === commandName)
            ?? studentCommandHelpMessages.find(message => message.nameValuePair[1] === commandName);
        if (helpMessage !== undefined) {
            await interaction.editReply(helpMessage?.message);
        } else {
            return Promise.reject(new CommandParseError('Command not found.'));
        }
        return undefined;
    }

    private async setLoggingChannel(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                'set_logging_channel',
                ['Bot Admin']
            ),
        ]);
        const loggingChannel = interaction.options.getChannel('channel', true) as TextChannel;
        if (loggingChannel.type !== 'GUILD_TEXT') {
            return Promise.reject(new CommandParseError(
                `${loggingChannel.name} is not a text channel.`
            ));
        }
        await this.serverMap.get(serverId)?.setLoggingChannel(loggingChannel);
        return `Successfully updated logging channel to \`#${loggingChannel.name}\`.`;
    }

    private async setQueueAutoClear(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                'set_queue_auto_clear',
                ['Bot Admin']
            ),
        ]);
        const hours = interaction.options.getInteger('hours', true);
        const enable = interaction.options.getBoolean('enable', true);
        this.serverMap.get(serverId)?.setQueueAutoClear(hours, enable);
        return Promise.resolve(
            enable
                ? `Successfully changed the auto clear timeout to be ${hours} hours.`
                : 'Successfully disabled queue auto clear.'
        );
    }

    private async stopLogging(interaction: CommandInteraction): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                'stop_logging',
                ['Bot Admin']
            ),
        ]);
        await this.serverMap.get(serverId)?.setLoggingChannel(undefined);
        return `Successfully stopped logging.`;
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