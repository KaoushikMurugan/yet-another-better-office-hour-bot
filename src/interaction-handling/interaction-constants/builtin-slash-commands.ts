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
import { Routes } from 'discord-api-types/v10';
import { ChannelType, Guild } from 'discord.js';
import { environment } from '../../environment/environment-manager.js';
import { CommandNames } from './interaction-names.js';
import { CommandData } from '../../utils/type-aliases.js';
import { serverSettingsMainMenuOptions } from '../../attending-server/server-settings-menus.js';
import { range } from '../../utils/util-functions.js';
import { LOGGER } from '../../global-states.js';

// /queue {add | remove} [queue_name]
const queueCommand = new SlashCommandBuilder()
    .setName(CommandNames.queue)
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
    .setName(CommandNames.enqueue)
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
    .setName(CommandNames.next)
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
    .setName(CommandNames.start)
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
    .setName(CommandNames.stop)
    .setDescription('Stop helping students');

// /leave
const leaveCommand = new SlashCommandBuilder()
    .setName(CommandNames.leave)
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
    .setName(CommandNames.clear)
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
    .setName(CommandNames.clear_all)
    .setDescription('Admin only. Clears all the queues on this server');

// /queue_notify [queue_name] [on | off]
const queueNotifyCommand = new SlashCommandBuilder()
    .setName(CommandNames.queue_notify)
    .setDescription('Toggle whether you want to be pinged when you are next in line')
    .addSubcommand(subcommand =>
        subcommand // /queue_notify on [queue_name]
            .setName('on')
            .setDescription('Turn on notifications for a queue')
            .addChannelOption(option =>
                option
                    .setName('queue_name')
                    .setDescription('The queue to turn on notifications for')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildCategory)
            )
    )
    .addSubcommand(subcommand =>
        subcommand // /queue_notify off [queue_name]
            .setName('off')
            .setDescription('Turn off notifications for a queue')
            .addChannelOption(option =>
                option
                    .setName('queue_name')
                    .setDescription('The queue to turn off notifications for')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildCategory)
            )
    );

// /announce [message] (queue_name)
const announceCommand = new SlashCommandBuilder()
    .setName(CommandNames.announce)
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
    .setName(CommandNames.list_helpers)
    .setDescription('See who is online and helping.');

// /cleanup_queue [queue_name]
const cleanupQueue = new SlashCommandBuilder()
    .setName(CommandNames.cleanup_queue)
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
    .setName(CommandNames.cleanup_all)
    .setDescription('Debug feature: Forces updates of embed in all #queue channels');

// /cleanup_help_channel
const cleanupHelpChannelCommand = new SlashCommandBuilder()
    .setName(CommandNames.cleanup_help_channels)
    .setDescription('Debug feature: Force updates the command help channels');

// /set_logging_channel [channel]
const setLoggingChannelCommand = new SlashCommandBuilder()
    .setName(CommandNames.set_logging_channel)
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
    .setName(CommandNames.stop_logging)
    .setDescription('Stops the bot from logging events');

// /create_offices [category_name] [office_name] [number_of_offices]
const createOfficesCommand = new SlashCommandBuilder()
    .setName(CommandNames.create_offices)
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
            .setDescription('The prefix of each office')
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option
            .setName('number_of_offices')
            .setDescription('The number of offices to create')
            .setRequired(true)
            .addChoices(
                ...range(10).map(i => ({
                    name: `${i + 1}`,
                    value: i + 1
                }))
            )
    );

// /set_roles [role_name] [@role]
const setRolesCommand = new SlashCommandBuilder()
    .setName(CommandNames.set_roles)
    .setDescription('Sets the roles that the bot to use')
    .addStringOption(option =>
        option
            .setName('role_name')
            .setDescription('The name of the role')
            .setRequired(true)
            .addChoices(
                { name: 'Staff', value: 'staff' },
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

// /quick_start
const quickStartCommand = new SlashCommandBuilder()
    .setName(CommandNames.quick_start)
    .setDescription('Quickly set up the bot for your server');
// /settings
function generateSettingsCommand() {
    return new SlashCommandBuilder()
        .setName(CommandNames.settings)
        .setDescription('Sets up the server config for the bot')
        .addStringOption(option =>
            option
                .setName('sub_menu_jump')
                .setDescription('The sub menu to jump to')
                .setRequired(false)
                .addChoices(
                    ...serverSettingsMainMenuOptions
                        .filter(option => option.useInSettingsCommand === true)
                        .map(option => ({
                            name: `${option.selectMenuOptionData.emoji} ${option.selectMenuOptionData.label}`,
                            value: option.selectMenuOptionData.value
                        }))
                )
        );
}

// /pause
const pauseCommand = new SlashCommandBuilder()
    .setName(CommandNames.pause)
    .setDescription(
        'Prevents students from joining the queue, but allows the helper to dequeue.'
    );

// /resume
const resumeCommand = new SlashCommandBuilder()
    .setName(CommandNames.resume)
    .setDescription('Allow students to join the queue again after /pause was used.');

const helpCommand = new SlashCommandBuilder()
    .setName(CommandNames.help)
    .setDescription('Get help with the bot');

// /set_time_zone
const setTimeZoneCommand = new SlashCommandBuilder()
    .setName(CommandNames.set_time_zone)
    .setDescription('Set the time zone of this server relative to UTC')
    .addStringOption(option =>
        option
            .setName('sign')
            .setDescription('Plus or Minute from UTC')
            .setRequired(true)
            .addChoices(
                {
                    name: '+',
                    value: '+'
                },
                {
                    name: '-',
                    value: '-'
                }
            )
    )
    .addIntegerOption(option =>
        option
            .setName('hours')
            .setDescription('Hours')
            .setRequired(true)
            .addChoices(
                ...range(13).map(i => ({
                    name: `${i}`,
                    value: i
                }))
            )
    )
    .addIntegerOption(option =>
        option.setName('minutes').setDescription('Minutes').setRequired(true).addChoices(
            {
                name: '0',
                value: 0
            },
            {
                name: '30',
                value: 30
            },
            {
                name: '45',
                value: 45
            }
        )
    );
// /assign_helpers_roles [csv_file]
const assignHelpersRolesCommand = new SlashCommandBuilder()
    .setName(CommandNames.assign_helpers_roles)
    .setDescription('Uses a .csv file to assign roles to all helpers')
    .addAttachmentOption(option =>
        option
            .setName('csv_file')
            .setDescription('The .csv file to use')
            .setRequired(true)
    );

// /create_helper_control_panel [channel]
const createHelperControlPanelCommand = new SlashCommandBuilder()
    .setName(CommandNames.create_helper_control_panel)
    .setDescription('Creates a helper menu in the specified channel')
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('The channel to create the helper menu in')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
    )
    .addBooleanOption(option =>
        option
            .setName('verbose')
            .setDescription('Whether to show a detailed message, defaults to true')
            .setRequired(false)
    );

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
    queueNotifyCommand.toJSON(),
    listHelpersCommand.toJSON(),
    announceCommand.toJSON(),
    cleanupQueue.toJSON(),
    cleanupAllQueues.toJSON(),
    cleanupHelpChannelCommand.toJSON(),
    setLoggingChannelCommand.toJSON(),
    stopLoggingCommand.toJSON(),
    createOfficesCommand.toJSON(),
    setRolesCommand.toJSON(),
    pauseCommand.toJSON(),
    resumeCommand.toJSON(),
    helpCommand.toJSON(),
    assignHelpersRolesCommand.toJSON(),
    quickStartCommand.toJSON(),
    setTimeZoneCommand.toJSON(),
    createHelperControlPanelCommand.toJSON()
];

async function postGuildSlashCommands(
    guild: Guild,
    externalCommands: CommandData = []
): Promise<void> {
    if (environment.discordBotCredentials.YABOB_APP_ID.length === 0) {
        throw new Error('Failed to post commands. APP_ID is undefined');
    }
    if (environment.discordBotCredentials.YABOB_BOT_TOKEN.length === 0) {
        throw new Error('Failed to post commands. BOT_TOKEN is undefined');
    }
    const rest = new REST().setToken(environment.discordBotCredentials.YABOB_BOT_TOKEN);
    await rest
        .put(
            Routes.applicationGuildCommands(
                environment.discordBotCredentials.YABOB_APP_ID,
                guild.id
            ),
            {
                // need to call generateHelpCommand() here because it needs to be called after the external help messages are added
                body: commandData.concat(
                    externalCommands,
                    generateSettingsCommand().toJSON()
                )
            }
        )
        .catch(err => LOGGER.error(err, `Failed to post slash command to ${guild.name}`));
    LOGGER.info(`✓ Updated slash commands on '${guild.name}' ✓`);
}

async function postGlobalSlashCommands(
    externalCommands: CommandData = []
): Promise<void> {
    if (environment.discordBotCredentials.YABOB_APP_ID.length === 0) {
        throw new Error('Failed to post commands. APP_ID is undefined');
    }
    if (environment.discordBotCredentials.YABOB_BOT_TOKEN.length === 0) {
        throw new Error('Failed to post commands. BOT_TOKEN is undefined');
    }
    const rest = new REST().setToken(environment.discordBotCredentials.YABOB_BOT_TOKEN);
    await rest
        .put(Routes.applicationCommands(environment.discordBotCredentials.YABOB_APP_ID), {
            // need to call generateHelpCommand() here because it needs to be called after the external help messages are added
            body: commandData.concat(externalCommands, generateSettingsCommand().toJSON())
        })
        .catch(err => CALENDAR_LOGGER.error(err, `Failed to post slash command to`));
    LOGGER.info(`✓ Updated slash commands ✓`);
}

export { postGuildSlashCommands, postGlobalSlashCommands };
