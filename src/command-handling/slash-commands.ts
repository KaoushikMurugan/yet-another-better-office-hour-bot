/*************************************************************************
 * This file defines the structure of the slash commands
 * .setName is the name of the command as it appears on Discord
 * options are the arguments of the command
 * .setRequired defines where the argument is required or not
 * Adopted from original BOB v3 by Noah & Kaoushik
 *************************************************************************/

import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { Guild } from 'discord.js';
import { FgMagenta, ResetColor } from '../utils/command-line-colors';
import environment from '../environment/environment-manager';
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands';

const queueCommand = new SlashCommandBuilder() // /queue
    .setName('queue')
    .setDescription('Add or remove queue channels to the server (admin only)')
    .addSubcommand(subcommand =>
        subcommand // /queue add [queue_name]
            .setName('add')
            .setDescription('Create a new queue channel')
            .addStringOption(option =>
                option
                    .setName('queue_name')
                    .setDescription('The name of the queue to create')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand // /queue remove [queue_name]
            .setName('remove')
            .setDescription('Remove an existing queue')
            .addChannelOption(option =>
                option
                    .setName('queue_name')
                    .setDescription('The name of the queue to remove')
                    .setRequired(true)
            )
    );

const enqueueCommand = new SlashCommandBuilder() // /enqueue [queue_name] (user)
    .setName('enqueue')
    .setDescription('Enter a help queue')
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription('The queue you want to wait on')
            .setRequired(false)
    );

const dequeueCommand = new SlashCommandBuilder() // /next (queue_name) (user)
    .setName('next')
    .setDescription('Bring in the next student to help from any of your queues (FIFO)')
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription('The queue to dequeue from')
            .setRequired(false)
    )
    .addUserOption(option =>
        option.setName('user').setDescription('A user to dequeue').setRequired(false)
    );

const startCommand = new SlashCommandBuilder() // /start (mute_notif)
    .setName('start')
    .setDescription('Start helping students')
    .addBooleanOption(option =>
        option
            .setName('mute_notif')
            .setDescription(
                'Set to true if you do not want to ping those who have enabled notifications. Default: False'
            )
            .setRequired(false)
    );

const stopCommand = new SlashCommandBuilder() // /stop
    .setName('stop')
    .setDescription('Stop helping students');

const leaveCommand = new SlashCommandBuilder() // /leave
    .setName('leave')
    .setDescription('Leave your current queue')
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription('The queue to leave from')
            .setRequired(false)
    );

const clearCommand = new SlashCommandBuilder() // /clear (queue_name) (all)
    .setName('clear')
    .setDescription('Clear all of the waiting students from a queue.')
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription('The queue to clear')
            .setRequired(true)
    );

const clearAllCommand = new SlashCommandBuilder()
    .setName('clear_all')
    .setDescription('Admin only. Clears all the queues on this server');

const announceCommand = new SlashCommandBuilder() // /announce [message] (queue_name)
    .setName('announce')
    .setDescription('Announce a message to all of the waiting students in a queue.')
    .addStringOption(option =>
        option
            .setName('message')
            .setDescription('The message to announce')
            .setRequired(true)
    )
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription(
                'The queue to announce in, or all queues if none is specified'
            )
            .setRequired(false)
    );

const listHelpersCommand = new SlashCommandBuilder() // /list_helpers
    .setName('list_helpers')
    .setDescription('See who is online and helping.');

const cleanupQueue = new SlashCommandBuilder()
    .setName('cleanup_queue')
    .setDescription(
        "Debug feature: Forces updates of embed in the specified queue's #queue channel"
    )
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription('The queue to clean')
            .setRequired(true)
    );

const cleanupAllQueues = new SlashCommandBuilder()
    .setName('cleanup_all')
    .setDescription('Debug feature: Forces updates of embed in all #queue channels');

const cleanupHelpChannelCommand = new SlashCommandBuilder()
    .setName('cleanup_help_channels')
    .setDescription('Debug feature: Force updates the command help channels');

const setAfterSessionMessageCommand = new SlashCommandBuilder()
    .setName('set_after_session_msg')
    .setDescription(
        'Sets the message automatically sent to students after they leave the voice chat'
    )
    .addStringOption(option =>
        option.setName('message').setDescription('The message to send').setRequired(true)
    )
    .addBooleanOption(option =>
        option
            .setName('enable')
            .setDescription('If false, the content in `message` will be ignored')
            .setRequired(true)
    );

function generateHelpCommand(): Omit<
    SlashCommandBuilder,
    'addSubcommand' | 'addSubcommandGroup'
> {
    return new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with the bot')
        .addStringOption(option =>
            option
                .setName('command')
                .setDescription('The command to get help with')
                .setRequired(true)
                .addChoices(
                    ...adminCommandHelpMessages
                        .filter(helpMessage => helpMessage.useInHelpCommand === true)
                        .map(helpMessage => helpMessage.nameValuePair),
                    ...helperCommandHelpMessages
                        .filter(helpMessage => helpMessage.useInHelpCommand === true)
                        .map(helpMessage => helpMessage.nameValuePair),
                    ...studentCommandHelpMessages
                        .filter(helpMessage => helpMessage.useInHelpCommand === true)
                        .map(helpMessage => helpMessage.nameValuePair)
                )
        );
}

const setLoggingChannelCommand = new SlashCommandBuilder()
    .setName('set_logging_channel')
    .setDescription('Sets the channel where the bot will log events')
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('The channel to log events to')
            .setRequired(true)
    );

const setQueueAutoClear = new SlashCommandBuilder()
    .setName('set_queue_auto_clear')
    .setDescription('Sets the timeout before automatically clearing all the queues')
    .addNumberOption(option =>
        option
            .setName('hours')
            .setDescription('Number of hours before next queue auto clear')
            .setRequired(true)
    )
    .addBooleanOption(option =>
        option
            .setName('enable')
            .setDescription(
                "Whether to enable auto clear, overrides the 'hours' parameter"
            )
            .setRequired(true)
    );

const stopLoggingCommand = new SlashCommandBuilder()
    .setName('stop_logging')
    .setDescription('Stops the bot from logging events');

// Get the raw data that can be sent to Discord
const commandData = [
    queueCommand.toJSON(),
    enqueueCommand.toJSON(),
    dequeueCommand.toJSON(),
    startCommand.toJSON(),
    stopCommand.toJSON(),
    leaveCommand.toJSON(),
    clearCommand.toJSON(),
    clearAllCommand.toJSON(),
    listHelpersCommand.toJSON(),
    announceCommand.toJSON(),
    cleanupQueue.toJSON(),
    cleanupAllQueues.toJSON(),
    cleanupHelpChannelCommand.toJSON(),
    setAfterSessionMessageCommand.toJSON(),
    setLoggingChannelCommand.toJSON(),
    stopLoggingCommand.toJSON(),
    setQueueAutoClear.toJSON()
];

async function postSlashCommands(
    guild: Guild,
    externalCommands: CommandData = []
): Promise<void> {
    if (environment.discordBotCredentials.YABOB_APP_ID.length === 0) {
        throw new Error('Failed to post commands. APP_ID is undefined');
    }
    if (environment.discordBotCredentials.YABOB_BOT_TOKEN.length === 0) {
        throw new Error('Failed to post commands. BOT_TOKEN is undefined');
    }
    const rest = new REST({ version: '9' }).setToken(
        environment.discordBotCredentials.YABOB_BOT_TOKEN
    );
    await rest
        .put(
            Routes.applicationGuildCommands(
                environment.discordBotCredentials.YABOB_APP_ID,
                guild.id
            ),
            {
                body: commandData.concat(externalCommands, generateHelpCommand().toJSON())
            }
            // need to call generateHelpCommand() here because it needs to be called after the external help messages are added
        )
        .catch(e => console.error(e));
    console.log(`${FgMagenta}✓ Updated slash commands on '${guild.name}' ✓${ResetColor}`);
}

type CommandData = typeof commandData;

export { postSlashCommands, CommandData };
