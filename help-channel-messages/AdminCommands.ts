import { MessageOptions } from "discord.js";
import { EmbedColor } from "../src/utils/embed-helper";

export const adminCommandsEmbed: Pick<MessageOptions, 'embeds'> = {
    embeds: [
        {
            color: EmbedColor.Neutral,
            title: 'Bot Admin Only Commands',
            timestamp: new Date(),
            author: {
                name: 'YABOB V4.',
                iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
            }
        },
        {
            color: EmbedColor.NoColor,
            title: 'Command: `/queue add [queue_name]`',
            fields: [
                {
                    name: 'Description',
                    value: 'Creates a new category with the name entered in `queue_name` and creates the #queue and #chat text channels within it.',
                    inline: false
                },
                {
                    name: 'Options',
                    value: '`queue_name: string`\nThe name of the new queue category. Can contain any characters that are allowed by discord for category names other than comma (,).',
                    inline: true
                },
                { name: '\u0002', value: '\u0002', inline: true },
                {
                    name: 'Example Usage',
                    value: '`/queue add new queue!`',
                    inline: true
                },
            ]
        },
        {
            color: EmbedColor.NoColor,
            title: 'Command: `/queue remove`',
            fields: [
                {
                    name: 'Description',
                    value: 'Deletes an existing category with the name entered in queue_name and the channels within it.',
                    inline: false
                },
                {
                    name: 'Options',
                    value: '`queue_name: Channel`\nThe queue category you want to delete.',
                    inline: true
                },
                { name: '\u0002', value: '\u0002', inline: true },
                {
                    name: 'Example Usage',
                    value: '`/queue remove existing queue`',
                    inline: true
                },
            ]
        },
        {
            color: EmbedColor.NoColor,
            title: 'Command: `/cleanup (queue_name)`',
            fields: [
                {
                    name: 'Description',
                    value: 'Debug feature. Cleans up everything in #queue for the specified queue and resends new embeds.',
                    inline: false
                },
                {
                    name: 'Options',
                    value: '`queue_name: Channel`\nThe queue to clean',
                    inline: true
                },
                { name: '\u0002', value: '\u0002', inline: true },
                {
                    name: 'Example Usage',
                    value: '`/cleanup class A`',
                    inline: true
                },
            ]
        },
        {
            color: EmbedColor.NoColor,
            title: 'Command: `/clean_up_help_ch`',
            fields: [
                {
                    name: 'Description',
                    value: 'Debug feature. Cleans up all the bot help channels and resends new embeds',
                },
                {
                    name: 'Options',
                    value: 'None',
                    inline: true
                },
                { name: '\u0002', value: '\u0002', inline: true },
                {
                    name: 'Example Usage',
                    value: '`/clean_up_help_ch',
                    inline: true
                },
            ]
        },
        {
            color: EmbedColor.NoColor,
            title: 'Command: `/clear_all`',
            fields: [
                {
                    name: 'Description',
                    value: 'Empties all queues in the server.',
                    inline: false
                },
                {
                    name: 'Options',
                    value: 'None',
                    inline: true
                },
                { name: '\u0002', value: '\u0002', inline: true },
                {
                    name: 'Example Usage',
                    value: '`/clear_all`',
                    inline: true
                },
            ]
        },
    ],
};