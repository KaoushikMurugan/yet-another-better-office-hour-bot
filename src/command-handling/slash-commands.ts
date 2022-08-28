/*************************************************************************
 * This file defines the structure of the slash commands
 * .setName is the name of the command as it appears on Discord
 * options are the arguments of the command
 * .setRequired defines where the argument is required or not
 * Adopted from original BOB v3 by Noah & Kaoushik
 *************************************************************************/

import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Guild } from "discord.js";

const queueCommand = new SlashCommandBuilder() // /queue
    .setName("queue")
    .setDescription("Add or remove queue channels to the server (admin only)")
    .addSubcommand((subcommand) =>
        subcommand // /queue add [queue_name]
            .setName("add")
            .setDescription("Create a new queue channel")
            .addStringOption((option) =>
                option
                    .setName("queue_name")
                    .setDescription("The name of the queue to create")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand // /queue remove [queue_name]
            .setName("remove")
            .setDescription("Remove an existing queue")
            .addChannelOption((option) =>
                option
                    .setName("queue_name")
                    .setDescription("The name of the queue to remove")
                    .setRequired(true)
            )
    );

const enqueueCommand = new SlashCommandBuilder() // /enqueue [queue_name] (user)
    .setName("enqueue")
    .setDescription("Enter a help queue")
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription("The queue you want to wait on")
            .setRequired(true)
    )
    .addUserOption((option) =>
        option
            .setName("user")
            .setDescription("The user to add to the queue (staff only).")
            .setRequired(false)
    );

const dequeueCommand = new SlashCommandBuilder() // /next (queue_name) (user)
    .setName("next")
    .setDescription(
        "Bring in the next student to help from any of your queues (FIFO)"
    )
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription("The queue to dequeue from")
            .setRequired(false)
    )
    .addUserOption((option) =>
        option
            .setName("user")
            .setDescription("A user to dequeue")
            .setRequired(false)
    );

const startCommand = new SlashCommandBuilder() // /start (mute_notif)
    .setName("start")
    .setDescription("Start helping students")
    .addBooleanOption((option) =>
        option
            .setName("mute_notif")
            .setDescription(
                "Set to true if you do not want to ping those who have enabled notifications. Default: False"
            )
            .setRequired(false)
    );

const stopCommand = new SlashCommandBuilder() // /stop
    .setName("stop")
    .setDescription("Stop helping students");

const leaveCommand = new SlashCommandBuilder() // /leave
    .setName("leave")
    .setDescription("Leave your current queue")
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription("The queue to leave from")
            .setRequired(true)
    );

const clearCommand = new SlashCommandBuilder() // /clear (queue_name) (all)
    .setName("clear")
    .setDescription("Clear all of the waiting students from a queue.")
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription("The queue to clear")
            .setRequired(true)
    )
    .addBooleanOption((option) =>
        option
            .setName("all")
            .setDescription("Clear all queues?")
            .setRequired(false)
    );

const announceCommand = new SlashCommandBuilder() // /announce [message] (queue_name)
    .setName("announce")
    .setDescription(
        "Announce a message to all of the waiting students in a queue."
    )
    .addStringOption((option) =>
        option
            .setName("message")
            .setDescription("The message to announce")
            .setRequired(true)
    )
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription(
                "The queue to announce in, or all queues if none is specified"
            )
            .setRequired(false)
    );

const listHelpersCommand = new SlashCommandBuilder() // /list_helpers
    .setName("list_helpers")
    .setDescription("See who is online and helping.");

const listNextHours = new SlashCommandBuilder() // /when_next (queue_name)
    .setName("when_next")
    .setDescription("View the upcoming tutoring hours")
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription(
                "The course for which you want to view the next tutoring hours"
            )
            .setRequired(false)
    );

const getNotifications = new SlashCommandBuilder() // /get_notifs [queue_name]
    .setName("notify_me")
    .setDescription("Get notified when the queue opens (not permanent)")
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription(
                "The course for which you want be notifed when its queue becomes open"
            )
            .setRequired(true)
    );

const removeNotifications = new SlashCommandBuilder() // /remove_notif [queue_name]
    .setName("remove_notif")
    .setDescription(
        "Remove yourself from a notification queue for a particular channel"
    )
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription(
                "The course for which you no longer want to be notified for"
            )
            .setRequired(true)
    );

const msgAfterLeaveVC = new SlashCommandBuilder()
    .setName("post_session_msg")
    .setDescription(
        "Commands to modify the message that is sent to tutees after their session"
    )
    .addSubcommand((subcommand) =>
        subcommand // /post_session_msg edit [enable] (change_message)
            .setName("edit")
            .setDescription(
                "enable/disable this feature and change the message that is sent"
            )
            .addBooleanOption((option) =>
                option
                    .setName("enable")
                    .setDescription(
                        "if false, then YABOB will not send any message to the tutee after their session [Default: false]"
                    )
                    .setRequired(true)
            )
            .addBooleanOption((option) =>
                option
                    .setName("change_message")
                    .setDescription(
                        "if true, grabs your previous message sent in this chat and sets it as the new message"
                    )
                    .setRequired(false)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand // /post_session_msg revert
            .setName("revert")
            .setDescription("reverts the message to the previous one")
    );

const setCalendar = new SlashCommandBuilder()
    .setName("calendar")
    .setDescription(
        "Commands to modify the resources connected to the /when_next command"
    )
    .addSubcommand((subcommand) =>
        subcommand // /set_calendar calendar [Calendar ID]
            .setName("set_calendar")
            .setDescription(
                "Connect the bot to a Google Calendar that lists tutoring hours"
            )
            .addStringOption((option) =>
                option
                    .setName("calendar_link")
                    .setDescription("The link to the calendar")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand // /set_calendar sheets [sheetsLink]
            .setName("set_sheets")
            .setDescription(
                "Connect the bot to a Google sheets document that contains Discord IDs and corresponding First Names"
            )
            .addStringOption((option) =>
                option
                    .setName("sheets_link")
                    .setDescription("The link to the google sheets")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("format_help")
            .setDescription(
                "Get an explanation of how the calendar and sheets have to be formatted"
            )
    );

const forceUpdateQueues = new SlashCommandBuilder()
    .setName("force_update_queues")
    .setDescription(
        "Debug feature: Forces updates of the queue and the schedule messages in all #queue channel"
    );

// Get the raw data that can be sent to Discord
const commandData = [
    queueCommand.toJSON(),
    enqueueCommand.toJSON(),
    dequeueCommand.toJSON(),
    startCommand.toJSON(),
    stopCommand.toJSON(),
    leaveCommand.toJSON(),
    clearCommand.toJSON(),
    listHelpersCommand.toJSON(),
    announceCommand.toJSON(),
    listNextHours.toJSON(),
    getNotifications.toJSON(),
    removeNotifications.toJSON(),
    msgAfterLeaveVC.toJSON(),
    setCalendar.toJSON(),
    forceUpdateQueues.toJSON(),
];

type BaseBOBCommands =
    | 'queue'
    | 'enqueue'
    | 'next'
    | 'start'
    | 'stop'
    | 'leave'
    | 'clear'
    | 'announce'
    | 'list_helpers'
    | 'notify_me'
    | 'remove_notif'
    | 'post_session_msg'
    | 'force_update_queues';

async function postSlashCommands(guild: Guild): Promise<void> {
    if (process.env.YABOB_APP_ID === undefined) {
        throw new Error('Failed to post commands. APP_ID is undefined');
    }
    if (process.env.YABOB_BOT_TOKEN === undefined) {
        throw new Error('Failed to post commands. BOT_TOKEN is undefined');
    }

    const rest = new REST({ version: "9" }).setToken(
        process.env.YABOB_BOT_TOKEN
    );
    await rest.put(Routes.applicationGuildCommands(
        process.env.YABOB_APP_ID,
        guild.id),
        { body: commandData }
    ).catch(e => console.error(e));
    console.log(`Updated slash commands on "${guild.name}"`);
}

export { BaseBOBCommands, postSlashCommands };