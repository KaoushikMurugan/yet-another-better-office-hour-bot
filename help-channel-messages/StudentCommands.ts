import { MessageOptions } from "discord.js";
import { EmbedColor } from "../src/utils/embed-helper";

const studentCommandsEmbed: Pick<MessageOptions, "embeds">[] = [
    {
        embeds: [{
            color: EmbedColor.Neutral,
            title: 'Commands Available To Everyone (Admin, Helper, Student)',
            timestamp: new Date(),
            author: {
                name: 'YABOB V4.',
                iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
            }
        }]
    },
    {
        embeds: [{
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
                {
                    name: 'Example Usage',
                    value: '`/enqueue ECS32A`',
                    inline: true
                },
            ]
        }]
    },
    {
        embeds: [{
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
                {
                    name: 'Example Usage',
                    value: '`/leave`',
                    inline: true
                },
            ]
        }]
    },
    {
        embeds: [{
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
                {
                    name: 'Example Usage',
                    value: '`/list_helpers`',
                    inline: true
                },
            ]
        }]
    }
];

export { studentCommandsEmbed };