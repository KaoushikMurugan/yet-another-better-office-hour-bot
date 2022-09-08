import { MessageOptions } from "discord.js";
import { EmbedColor } from "../src/utils/embed-helper";

export const helperCommandsEmbed: Pick<MessageOptions, 'embeds'>[] = [
    { embeds: [{
        color: EmbedColor.Neutral,
        title: 'Bot Admin & Helper Only Commands',
        timestamp: new Date(),
        author: {
            name: 'YABOB V4.',
            iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
        }
    }]},
    { embeds: [{
        color: EmbedColor.NoColor,
        title: 'Command: `/start (mute_notif)`',
        fields: [
            {
                name: 'Description',
                value: 'Open queues that the Helper/Admin is assigned to help for.',
                inline: false
            },
            {
                name: 'Options',
                value: "`mute_notif: boolean`\nDon't notify users that have enabled notifications for queues assigned to a Helper/Admin.",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/start`',
                inline: true
            },
        ]
    }]},
    { embeds: [{
        color: EmbedColor.NoColor,
        title: 'Command: `/stop`',
        fields: [
            {
                name: 'Description',
                value: 'Close the OH-queue and stop students from entering the queue.\n\nStudents that were in the queue before closing will still be regisitered for OH and be in the queue for the next OH.',
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
                value: '`/stop`',
                inline: true
            },
        ]
    }]},
    { embeds: [{
        color: EmbedColor.NoColor,
        title: 'Command: `/next (queue_name) (user)`',
        fields: [
            {
                name: 'Description',
                value: 'Removes the next student from a queue and sends them an invite to a voice channel.',
                inline: false
            },
            {
                name: 'Options',
                value: "`queue_name: Channel`\nDequeue the first student from a particular queue\n\n`user: User`\nDequeue a specific user.",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/next`',
                inline: true
            },
        ]
    }]},
    { embeds: [{
        color: EmbedColor.NoColor,
        title: 'Command: `/announce [message] (queue_name)`',
        fields: [
            {
                name: 'Description',
                value: 'Sends a messeage to all of the queues that you are currently helping.',
                inline: false
            },
            {
                name: 'Options',
                value: "`queue_name: Channel`\nSends the message to only those in a queue specficied in`queue_name`",
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
        title: 'Command: `/clear (queue_name)`',
        fields: [
            {
                name: 'Description',
                value: 'Empties a queue of students. You can only clear a queue that you are a helper for, or if you are a Bot Admin.',
                inline: false
            },
            {
                name: 'Options',
                value: "`queue_name: Channel`\nThe queue to clear",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/clear class A`',
                inline: true
            },
        ]
    }]},
];