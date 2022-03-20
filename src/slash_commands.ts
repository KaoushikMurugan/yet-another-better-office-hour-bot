import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9';
import { Guild } from 'discord.js';

const queue_command = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Add or remove queue channels to the server (admin only)')
    .addSubcommand(subcommand => subcommand
        .setName('add')
        .setDescription('Create a new queue channel')
        .addStringOption(option => option
            .setName('queue_name')
            .setDescription('The name of the queue to create')
            .setRequired(true)))
    .addSubcommand(subcommand => subcommand
        .setName('remove')
        .setDescription('Remove an existing queue')
        .addChannelOption(option => option
            .setName('queue_name')
            .setDescription('The name of the queue to remove')
            .setRequired(true)))

const enqueue_command = new SlashCommandBuilder()
    .setName('enqueue')
    .setDescription('Enter a help queue')
    .addChannelOption(option => option
        .setName('queue_name')
        .setDescription('The queue you want to wait on')
        .setRequired(true))
    .addUserOption(option => option
        .setName('user')
        .setDescription('The user to add to the queue (staff only).')
        .setRequired(false))

const dequeue_command = new SlashCommandBuilder()
    .setName('next')
    .setDescription('Bring in the next student to help from any of your queues (FIFO)')
    .addChannelOption(option => option
        .setName('queue_name')
        .setDescription('The queue to dequeue from')
        .setRequired(false))
    .addUserOption(option => option
        .setName('user')
        .setDescription('A user to dequeue')
        .setRequired(false))

const start_command = new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start helping students')

const stop_command = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop helping students')

const leave_command = new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave your current queue')

const clear_command = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all of the waiting students from a queue.')
    .addChannelOption(option => option
        .setName('queue_name')
        .setDescription('The queue to clear')
        .setRequired(false))
    .addBooleanOption(option => option
        .setName('all')
        .setDescription('Clear all queues?')
        .setRequired(false))

const list_helpers_command = new SlashCommandBuilder()
    .setName('list_helpers')
    .setDescription('See who is online and helping.')

// Get the raw data that can be sent to Discord
const commandData = [
    queue_command.toJSON(),
    enqueue_command.toJSON(),
    dequeue_command.toJSON(),
    start_command.toJSON(),
    stop_command.toJSON(),
    leave_command.toJSON(),
    clear_command.toJSON(),
    list_helpers_command.toJSON()
]

export async function PostSlashCommands(guild: Guild): Promise<void> {
    const rest = new REST({version: '9'}).setToken(process.env.BOB_BOT_TOKEN as string)
    await rest.put(Routes.applicationGuildCommands(process.env.BOB_APP_ID as string, guild.id), {body: commandData}).catch(console.error)
    console.log(`Updated slash commands on "${guild.name}"`)
}