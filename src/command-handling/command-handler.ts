/** @module BuiltInHandlers */

import {
    ChannelType,
    ChatInputCommandInteraction,
    GuildChannel,
    GuildMember,
    GuildMemberRoleManager,
    TextChannel
} from 'discord.js';
import {
    EmbedColor,
    SimpleEmbed,
    ErrorEmbed,
    SlashCommandLogEmbed,
    ErrorLogEmbed
} from '../utils/embed-helper';
import { CommandParseError } from '../utils/error-types';
import {
    isTriggeredByUserWithRoles,
    hasValidQueueArgument,
    isFromGuildMember,
    isTriggeredByUserWithRolesSync
} from './common-validations';
import { convertMsToTime, logSlashCommand } from '../utils/util-functions';
// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { CommandCallback } from '../utils/type-aliases';
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands';
import { afterSessionMessageModal, queueAutoClearModal } from './modal-objects';
import { attendingServers } from '../global-states';
import { ExpectedParseErrors } from './expected-interaction-errors';

/**
 * Responsible for preprocessing commands and dispatching them to servers
 * ----
 * Each YABOB instance should only have 1 BuiltInCommandHandler
 * All the functions below follows this convention:
 * - private async <corresponding command name>(interaction): Promise<string>
 * @category Handler Classes
 * @param interaction the raw interaction
 * @throws CommandParseError: if command doesn't satify the checks in Promise.all
 * @throws QueueError or ServerError: if the target HelpQueueV2 or AttendingServer rejects
 */
class BuiltInCommandHandler {
    // The map of available commands
    // Key is what the user will see, value is the arrow function
    // - arrow function wrapper is required because of the closure of 'this'
    // undefined return values is when the method wants to reply to the interaction directly
    // - If a call returns undefined, processCommand won't edit the reply
    private commandMethodMap: ReadonlyMap<string, CommandCallback> = new Map<
        string,
        CommandCallback
    >([
        ['announce', interaction => this.announce(interaction)],
        ['cleanup_queue', interaction => this.cleanup(interaction)],
        ['cleanup_all', interaction => this.cleanupAllQueues(interaction)],
        ['cleanup_help_channels', interaction => this.cleanupHelpChannel(interaction)],
        ['clear', interaction => this.clear(interaction)],
        ['clear_all', interaction => this.clearAll(interaction)],
        ['enqueue', interaction => this.enqueue(interaction)],
        ['leave', interaction => this.leave(interaction)],
        ['list_helpers', interaction => this.listHelpers(interaction)],
        ['next', interaction => this.next(interaction)],
        ['queue', interaction => this.queue(interaction)],
        ['start', interaction => this.start(interaction)],
        ['stop', interaction => this.stop(interaction)],
        ['help', interaction => this.help(interaction)],
        ['set_logging_channel', interaction => this.setLoggingChannel(interaction)],
        ['stop_logging', interaction => this.stopLogging(interaction)],
        [
            'set_after_session_msg',
            interaction => this.showAfterSessionMessageModal(interaction)
        ],
        ['set_queue_auto_clear', interaction => this.showQueueAutoClearModal(interaction)]
    ]);

    /**
     * Commands in this set only shows a modal on ChatInputCommandInteraction
     * Actual changes to attendingServers happens on modal submit
     * - See modal-handler.ts
     */
    private showModalOnlyCommands = new Set<string>([
        'set_after_session_msg',
        'set_queue_auto_clear'
    ]);

    canHandle(interaction: ChatInputCommandInteraction): boolean {
        return this.commandMethodMap.has(interaction.commandName);
    }

    /**
     * Main processor for command interactions
     * @param interaction the raw interaction from discord js
     */
    async process(interaction: ChatInputCommandInteraction): Promise<void> {
        const serverId = this.isServerInteraction(interaction);
        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (!this.showModalOnlyCommands.has(interaction.commandName)) {
            // Immediately reply to show that YABOB has received the interaction
            // non modal commands only
            await interaction.reply({
                ...SimpleEmbed(
                    `Processing command \`${interaction.commandName}\`...`,
                    EmbedColor.Neutral
                ),
                ephemeral: true
            });
        }
        logSlashCommand(interaction);
        await commandMethod?.(interaction)
            // shorthand syntax, if successMsg is undefined, don't run the rhs
            .then(async successMsg => {
                await Promise.all<unknown>([
                    successMsg &&
                        interaction.editReply(
                            SimpleEmbed(successMsg, EmbedColor.Success)
                        ),
                    attendingServers
                        .get(serverId)
                        ?.sendLogMessage(SlashCommandLogEmbed(interaction))
                ]);
            })
            .catch(async err => {
                // Central error handling, reply to user with the error
                await Promise.all([
                    // if not replied (when using modals), reply
                    interaction.replied
                        ? interaction.editReply(ErrorEmbed(err))
                        : interaction.reply({ ...ErrorEmbed(err), ephemeral: true }),
                    attendingServers
                        .get(serverId)
                        ?.sendLogMessage(ErrorLogEmbed(err, interaction))
                ]);
            });
    }

    private async queue(interaction: ChatInputCommandInteraction): Promise<string> {
        const serverId = this.isServerInteraction(interaction);
        await isTriggeredByUserWithRoles(
            interaction,
            `queue ${interaction.options.getSubcommand()}`,
            ['Bot Admin']
        );
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'add': {
                const queueName = interaction.options.getString('queue_name', true);
                await attendingServers.get(serverId)?.createQueue(queueName);
                return `Successfully created \`${queueName}\`.`;
            }
            case 'remove': {
                const targetQueue = hasValidQueueArgument(interaction, true);
                if (
                    (interaction.channel as GuildChannel).parent?.id ===
                    targetQueue.parentCategoryId
                ) {
                    throw ExpectedParseErrors.removeInsideQueue;
                }
                await attendingServers
                    .get(serverId)
                    ?.deleteQueueById(targetQueue.parentCategoryId);
                return `Successfully deleted \`${targetQueue.queueName}\`.`;
            }
            default: {
                throw new CommandParseError(`Invalid /queue subcommand ${subcommand}.`);
            }
        }
    }

    private async enqueue(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId, queueChannel, member] = [
            this.isServerInteraction(interaction),
            hasValidQueueArgument(interaction),
            isFromGuildMember(interaction)
        ];
        await attendingServers.get(serverId)?.enqueueStudent(member, queueChannel);
        return `Successfully joined \`${queueChannel.queueName}\`.`;
    }

    private async next(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId, helperMember] = [
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRolesSync(interaction, 'next', ['Bot Admin', 'Staff'])
        ];
        const targetQueue =
            interaction.options.getChannel('queue_name', false) === null
                ? undefined
                : hasValidQueueArgument(interaction, true);
        const targetStudent =
            interaction.options.getMember('user') === null
                ? undefined
                : (interaction.options.getMember('user') as GuildMember);
        // if either target queue or target student is specified, use dequeueWithArgs
        // otherwise use dequeueGlobalFirst
        const dequeuedStudent =
            targetQueue || targetStudent
                ? await attendingServers
                      .get(serverId)
                      ?.dequeueWithArgs(helperMember, targetStudent, targetQueue)
                : await attendingServers.get(serverId)?.dequeueGlobalFirst(helperMember);
        return `An invite has been sent to ${dequeuedStudent?.member.displayName}.`;
    }

    private async start(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId, member] = [
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRolesSync(interaction, 'start', ['Bot Admin', 'Staff'])
        ];
        const muteNotif = interaction.options.getBoolean('mute_notif') ?? false;
        await attendingServers.get(serverId)?.openAllOpenableQueues(member, !muteNotif);
        return `You have started helping! Have fun!`;
    }

    private async stop(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId, member] = [
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRolesSync(interaction, 'stop', ['Bot Admin', 'Staff'])
        ];
        const helpTimeEntry = await attendingServers
            .get(serverId)
            ?.closeAllClosableQueues(member);
        return (
            `You helped for ` +
            convertMsToTime(
                // error will be thrown closeAllClosableQueues if that goes wrong, so we can assert non-null
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                helpTimeEntry!.helpEnd.getTime() - helpTimeEntry!.helpStart.getTime()
            ) +
            `. See you later!`
        );
    }

    private async leave(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId, member, queue] = [
            this.isServerInteraction(interaction),
            isFromGuildMember(interaction),
            hasValidQueueArgument(interaction)
        ];
        await attendingServers.get(serverId)?.removeStudentFromQueue(member, queue);
        return `You have successfully left from queue ${queue.queueName}.`;
    }

    private async clear(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId, queue] = [
            this.isServerInteraction(interaction),
            hasValidQueueArgument(interaction, true),
            await isTriggeredByUserWithRoles(interaction, 'clear', ['Bot Admin', 'Staff'])
        ];
        // casting is safe because we checked for isServerInteraction
        const memberRoles = interaction.member?.roles as GuildMemberRoleManager;
        // if they are not admin or doesn't have the queue role, reject
        if (
            !memberRoles.cache.some(
                role => role.name === queue.queueName || role.name === 'Bot Admin'
            )
        ) {
            throw ExpectedParseErrors.noPermission.clear(queue.queueName);
        }
        await attendingServers.get(serverId)?.clearQueue(queue);
        return `Everyone in  queue ${queue.queueName} was removed.`;
    }

    private async clearAll(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId] = [
            this.isServerInteraction(interaction),
            await isTriggeredByUserWithRoles(interaction, 'clear_all', ['Bot Admin'])
        ];
        const server = attendingServers.get(serverId);
        const allQueues = await server?.getQueueChannels();
        if (allQueues?.length === 0) {
            throw ExpectedParseErrors.serverHasNoQueue;
        }
        await server?.clearAllQueues();
        return `All queues on ${server?.guild.name} was cleard.`;
    }

    private async listHelpers(
        interaction: ChatInputCommandInteraction
    ): Promise<undefined> {
        const serverId = this.isServerInteraction(interaction);
        const helpers = attendingServers.get(serverId)?.activeHelpers;
        if (helpers === undefined || helpers.size === 0) {
            await interaction.editReply(SimpleEmbed('No one is currently helping.'));
            return undefined;
        }
        const allQueues =
            (await attendingServers.get(serverId)?.getQueueChannels()) ?? [];
        const table = new AsciiTable3()
            .setHeading('Tutor name', 'Availbale Queues', 'Time Elapsed', 'Status')
            .setAlign(1, AlignmentEnum.CENTER)
            .setAlign(2, AlignmentEnum.CENTER)
            .setAlign(3, AlignmentEnum.CENTER)
            .setAlign(4, AlignmentEnum.CENTER)
            .setStyle('unicode-mix')
            .addRowMatrix(
                [...helpers.values()].map(helper => [
                    helper.member.displayName, // Tutor Name
                    helper.member.roles.cache
                        .filter(
                            role =>
                                allQueues.find(queue => queue.queueName === role.name) !==
                                undefined
                        )
                        .map(role => role.name)
                        .toString(), // Available Queues
                    convertMsToTime(new Date().valueOf() - helper.helpStart.valueOf()), // Time Elapsed
                    (() => {
                        const voiceChannel = interaction.guild?.voiceStates.cache.get(
                            helper.member.id
                        )?.channel;
                        if (!voiceChannel) {
                            return 'Not in voice channel';
                        }
                        return voiceChannel.members.size > 1
                            ? `Busy in [${voiceChannel.name}]`
                            : `Idling in [${voiceChannel.name}]`;
                    })() // Status, IIFE to cram in more logic
                ])
            )
            .setWidths([10, 10, 10, 10])
            .setWrapped(1)
            .setWrapped(2)
            .setWrapped(3)
            .setWrapped(4);
        await interaction.editReply(
            SimpleEmbed(
                'Current Helpers',
                EmbedColor.Aqua,
                '```' + table.toString() + '```'
            )
        );
        return undefined;
    }

    private async announce(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId, member] = [
            this.isServerInteraction(interaction),
            await isTriggeredByUserWithRoles(interaction, 'announce', [
                'Bot Admin',
                'Staff'
            ])
        ];
        const announcement = interaction.options.getString('message', true);
        const optionalChannel = interaction.options.getChannel('queue_name', false);
        if (optionalChannel !== null) {
            const queueChannel = hasValidQueueArgument(interaction, true);
            await attendingServers
                .get(serverId)
                ?.announceToStudentsInQueue(member, announcement, queueChannel);
        } else {
            await attendingServers
                .get(serverId)
                ?.announceToStudentsInQueue(member, announcement);
        }
        return `Your announcement: ${announcement} has been sent!`;
    }

    private async cleanup(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId, queue] = [
            this.isServerInteraction(interaction),
            hasValidQueueArgument(interaction, true),
            await isTriggeredByUserWithRoles(interaction, 'cleanup', ['Bot Admin'])
        ];
        await attendingServers.get(serverId)?.cleanUpQueue(queue);
        return `Queue ${queue.queueName} has been cleaned up.`;
    }

    private async cleanupAllQueues(
        interaction: ChatInputCommandInteraction
    ): Promise<string> {
        const [serverId] = [
            this.isServerInteraction(interaction),
            await isTriggeredByUserWithRoles(interaction, 'cleanup', ['Bot Admin'])
        ];
        await Promise.all(
            (
                await attendingServers.get(serverId)?.getQueueChannels()
            )?.map(queueChannel =>
                attendingServers.get(serverId)?.cleanUpQueue(queueChannel)
            ) ?? []
        );
        return `All queues have been cleaned up.`;
    }

    private async cleanupHelpChannel(
        interaction: ChatInputCommandInteraction
    ): Promise<string> {
        const [serverId] = [
            this.isServerInteraction(interaction),
            await isTriggeredByUserWithRoles(interaction, 'cleanup_help_channel', [
                'Bot Admin'
            ])
        ];
        await attendingServers.get(serverId)?.updateCommandHelpChannels();
        return `Successfully cleaned up everything under 'Bot Commands Help'.`;
    }

    private async showAfterSessionMessageModal(
        interaction: ChatInputCommandInteraction
    ): Promise<undefined> {
        const [serverId] = [
            this.isServerInteraction(interaction),
            await isTriggeredByUserWithRoles(interaction, 'set_after_session_msg', [
                'Bot Admin'
            ])
        ];
        await interaction.showModal(afterSessionMessageModal(serverId));
        return undefined;
    }

    private async help(interaction: ChatInputCommandInteraction): Promise<undefined> {
        const commandName = interaction.options.getString('command', true);
        const helpMessage =
            adminCommandHelpMessages.find(
                message => message.nameValuePair.name === commandName
            ) ??
            helperCommandHelpMessages.find(
                message => message.nameValuePair.name === commandName
            ) ??
            studentCommandHelpMessages.find(
                message => message.nameValuePair.name === commandName
            );
        if (helpMessage !== undefined) {
            await interaction.editReply(helpMessage?.message);
        } else {
            throw new CommandParseError('Command not found.');
        }
        return undefined;
    }

    private async setLoggingChannel(
        interaction: ChatInputCommandInteraction
    ): Promise<string> {
        const [serverId] = [
            this.isServerInteraction(interaction),
            await isTriggeredByUserWithRoles(interaction, 'set_logging_channel', [
                'Bot Admin'
            ])
        ];
        const loggingChannel = interaction.options.getChannel(
            'channel',
            true
        ) as TextChannel;
        if (loggingChannel.type !== ChannelType.GuildText) {
            throw new CommandParseError(`${loggingChannel.name} is not a text channel.`);
        }
        await attendingServers.get(serverId)?.setLoggingChannel(loggingChannel);
        return `Successfully updated logging channel to \`#${loggingChannel.name}\`.`;
    }

    private async showQueueAutoClearModal(
        interaction: ChatInputCommandInteraction
    ): Promise<undefined> {
        const [serverId] = [
            this.isServerInteraction(interaction),
            await isTriggeredByUserWithRoles(interaction, 'set_queue_auto_clear', [
                'Bot Admin'
            ])
        ];
        await interaction.showModal(queueAutoClearModal(serverId));
        return undefined;
    }

    private async stopLogging(interaction: ChatInputCommandInteraction): Promise<string> {
        const [serverId] = [
            this.isServerInteraction(interaction),
            await isTriggeredByUserWithRoles(interaction, 'stop_logging', ['Bot Admin'])
        ];
        await attendingServers.get(serverId)?.setLoggingChannel(undefined);
        return `Successfully stopped logging.`;
    }

    /**
     * Checks if the command came from a server with correctly initialized YABOB
     * Each handler will have their own isServerInteraction method
     * @returns string: the server id
     */
    private isServerInteraction(interaction: ChatInputCommandInteraction): string {
        const serverId = interaction.guild?.id;
        if (!serverId || !attendingServers.has(serverId)) {
            throw ExpectedParseErrors.nonServerInterction(interaction.guild?.name);
        } else {
            return serverId;
        }
    }
}

export { BuiltInCommandHandler };
