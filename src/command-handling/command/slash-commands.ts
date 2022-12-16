/** @module BuiltInHandlers */
/**
 * This file defines the structure of the slash commands
 * - setName is the name of the command as it appears on Discord
 * - options are the arguments of the command
 * - setRequired defines where the argument is required or not
 * Adopted from original BOB v3 by Noah & Kaoushik
 * @packageDocumentation
 */
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { ChannelType, Guild } from 'discord.js';
import { magenta, red } from '../../utils/command-line-colors.js';
import { environment } from '../../environment/environment-manager.js';
import { adminCommandHelpMessages } from '../../../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../../../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../../../help-channel-messages/StudentCommands.js';

// /queue {add | remove} [queue_name]
const queueCommand = new SlashCommandBuilder()
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
                    .addChannelTypes(ChannelType.GuildCategory)
            )
    );

// /enqueue [queue_name] (user)
const enqueueCommand = new SlashCommandBuilder()
    .setName('enqueue')
    .setDescription('Enter a help queue')
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription('The queue you want to wait on')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildCategory)
    );

// /next (queue_name) (user)
const dequeueCommand = new SlashCommandBuilder()
    .setName('next')
    .setDescription('Bring in the next student to help from any of your queues (FIFO)')
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription('The queue to dequeue from')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildCategory)
    )
    .addUserOption(option =>
        option.setName('user').setDescription('A user to dequeue').setRequired(false)
    );

// /start (mute_notif)
const startCommand = new SlashCommandBuilder()
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

// /stop
const stopCommand = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop helping students');

// /leave
const leaveCommand = new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave your current queue')
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription('The queue to leave from')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildCategory)
    );

// /clear (queue_name) (all)
const clearCommand = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all of the waiting students from a queue.')
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription('The queue to clear')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
    );

// /clear_all
const clearAllCommand = new SlashCommandBuilder()
    .setName('clear_all')
    .setDescription('Admin only. Clears all the queues on this server');

// /announce [message] (queue_name)
const announceCommand = new SlashCommandBuilder()
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
            .addChannelTypes(ChannelType.GuildCategory)
    );

// /list_helpers
const listHelpersCommand = new SlashCommandBuilder()
    .setName('list_helpers')
    .setDescription('See who is online and helping.');

// /cleanup_queue [queue_name]
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
            .addChannelTypes(ChannelType.GuildCategory)
    );

// /cleanup_all
const cleanupAllQueues = new SlashCommandBuilder()
    .setName('cleanup_all')
    .setDescription('Debug feature: Forces updates of embed in all #queue channels');

// /cleanup_help_channel
const cleanupHelpChannelCommand = new SlashCommandBuilder()
    .setName('cleanup_help_channels')
    .setDescription('Debug feature: Force updates the command help channels');

// /set_after_session_message
const setAfterSessionMessageCommand = new SlashCommandBuilder()
    .setName('set_after_session_msg')
    .setDescription(
        'Sets the message automatically sent to students after they leave the voice chat'
    );

// /set_queue_auto_clear
const setQueueAutoClear = new SlashCommandBuilder()
    .setName('set_queue_auto_clear')
    .setDescription('Sets the timeout before automatically clearing all the queues');

// /set_logging_channel [channel]
const setLoggingChannelCommand = new SlashCommandBuilder()
    .setName('set_logging_channel')
    .setDescription('Sets the channel where the bot will log events')
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('The channel to log events to')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
    );

// /stop_logging
const stopLoggingCommand = new SlashCommandBuilder()
    .setName('stop_logging')
    .setDescription('Stops the bot from logging events');

// /serious_mode [enable]
const activateSeriousModeCommand = new SlashCommandBuilder()
    .setName('serious_mode')
    .setDescription('Activates serious mode')
    .addSubcommand(subcommand =>
        subcommand.setName('on').setDescription('Turns on serious mode')
    )
    .addSubcommand(subcommand =>
        subcommand.setName('off').setDescription('Turns off serious mode')
    );

// /create_officies [category_name] [office_name] [number_of_offices]
const createOfficesCommand = new SlashCommandBuilder()
    .setName('create_offices')
    .setDescription('Creates the a set number of voice channels in a new category')
    .addStringOption(option =>
        option
            .setName('category_name')
            .setDescription('The name of the category to create the offices in')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('office_name')
            .setDescription('The name of the office')
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option
            .setName('number_of_offices')
            .setDescription('The number of offices to create')
            .setRequired(true)
            .addChoices(
                { name: '1', value: 1 },
                { name: '2', value: 2 },
                { name: '3', value: 3 },
                { name: '4', value: 4 },
                { name: '5', value: 5 },
                { name: '6', value: 6 },
                { name: '7', value: 7 },
                { name: '8', value: 8 },
                { name: '9', value: 9 },
                { name: '10', value: 10 }
            )
    );

// /set_roles [role_name] [@role]
const setRolesCommand = new SlashCommandBuilder()
    .setName('set_roles')
    .setDescription('Sets the roles that the bot to use')
    .addStringOption(option =>
        option
            .setName('role_name')
            .setDescription('The name of the role')
            .setRequired(true)
            .addChoices(
                { name: 'Helper', value: 'helper' },
                { name: 'Bot Admin', value: 'bot_admin' },
                { name: 'Student', value: 'student' }
            )
    )
    .addRoleOption(option =>
        option
            .setName('role')
            .setDescription('The role to set to the specified role name')
            .setRequired(true)
    );

// /settings
const settingsCommand = new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Sets up the server config for the bot');

// /auto_give_student_role {on|off}
const autoGiveStudentRoleCommand = new SlashCommandBuilder()
    .setName('auto_give_student_role')
    .setDescription('Automatically gives the student role to new members')
    .addSubcommand(subcommand =>
        subcommand.setName('on').setDescription('Turns on auto giving student role')
    )
    .addSubcommand(subcommand =>
        subcommand.setName('off').setDescription('Turns off auto giving student role')
    );

// /help
/**
 * Generates the help command based on adminCommandHelpMessages,
 * helperCommandHelpMessages,and studentCommandHelpMessages
 */
function generateHelpCommand() {
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
                        .filter(helpMessage => helpMessage.useInHelpCommand)
                        .map(helpMessage => helpMessage.nameValuePair),
                    ...helperCommandHelpMessages
                        .filter(helpMessage => helpMessage.useInHelpCommand)
                        .map(helpMessage => helpMessage.nameValuePair),
                    ...studentCommandHelpMessages
                        .filter(helpMessage => helpMessage.useInHelpCommand)
                        .map(helpMessage => helpMessage.nameValuePair)
                )
        );
}

/** The raw data that can be sent to Discord */
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
    setQueueAutoClear.toJSON(),
    activateSeriousModeCommand.toJSON(),
    createOfficesCommand.toJSON(),
    setRolesCommand.toJSON(),
    settingsCommand.toJSON(),
    autoGiveStudentRoleCommand.toJSON()
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
                // need to call generateHelpCommand() here because it needs to be called after the external help messages are added
                body: commandData.concat(externalCommands, generateHelpCommand().toJSON())
            }
        )
        .catch(e =>
            console.error(red(`Failed to post slash command to ${guild.name}`), e)
        );
    console.log(magenta(`✓ Updated slash commands on '${guild.name}' ✓`));
}

/** Type alias for interaction extensions */
type CommandData = typeof commandData;

export { postSlashCommands, CommandData };
