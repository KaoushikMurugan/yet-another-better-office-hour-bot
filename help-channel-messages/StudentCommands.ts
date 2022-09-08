import { MessageOptions } from "discord.js";
import { EmbedColor } from "../src/utils/embed-helper";

export const studentCommandsEmbed: Pick<MessageOptions, "embeds">[] = [
    { embeds: [{
        color: EmbedColor.Neutral,
        title: 'Commands Available To Everyone (Admin, Helper, Student)',
        timestamp: new Date(),
        author: {
            name: 'YABOB V4.',
            iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
        }
    }]},
    { embeds: [{
        color: EmbedColor.NoColor,
        title: 'Command: `/enqueue [queue_name]`',
        fields: [
            {
                name: 'Description',
                value: 'Adds sender to the back of the queue `queue_name`',
                inline: false
            },
            {
                name: 'Options',
                value: "None",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/enqueue ECS32A`',
                inline: true
            },
        ]
    }]},
    { embeds: [{
        color: EmbedColor.NoColor,
        title: 'Command: `/leave`',
        fields: [
            {
                name: 'Description',
                value: 'Removes sender from ALL the queues in which they are in.',
                inline: false
            },
            {
                name: 'Options',
                value: "None",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/leave`',
                inline: true
            },
        ]
    }]},
    { embeds: [{
        color: EmbedColor.NoColor,
        title: 'Command: `/list_helpers`',
        fields: [
            {
                name: 'Description',
                value: "Shows a list of Helpers that are currently available, the queues for which they help for and how long they've been helping for.",
                inline: false
            },
            {
                name: 'Options',
                value: "None",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/list_helpers`',
                inline: true
            },
        ]
    }]},
    { embeds: [{
        color: EmbedColor.NoColor,
        title: 'Command: `/notify_me [queue_name]`',
        fields: [
            {
                name: 'Description',
                value: 'Adds a user to the notifcation list for a queue. They will be sent a direct message once the queue they listed is open.',
                inline: false
            },
            {
                name: 'Options',
                value: "`queue_name: Channel`\nThe queue to be notified of.",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/announce some announcement`',
                inline: true
            },
        ]
    }]},
    { embeds: [{
        color: EmbedColor.NoColor,
        title: 'Command: `/remove_notif [queue_name]`',
        fields: [
            {
                name: 'Description',
                value: 'Removes a user from the notification list for a queue.',
                inline: false
            },
            {
                name: 'Options',
                value: "Required: `queue_name: Channel`\nThe queue to remove notification from.",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/remove_notif ECS32A`',
                inline: true
            },
        ]
    }]},
];