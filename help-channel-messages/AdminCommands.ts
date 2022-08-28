import { MessageOptions } from "discord.js";
import { EmbedColor } from "../src/utils/embed-helper";


export const adminCommandsObj: Pick<MessageOptions, "embeds"> = {
    embeds: [{
        color: EmbedColor.Neutral,
        title: 'Admin & Helper Only Commands',
        timestamp: new Date(),
        author: {
            name: 'BOBv3',
            iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
        },
        fields: [
            { name: '\u200B', value: '-'.repeat(30), inline: false },
            {
                name: '`/start (mute_notif)`',
                value: 'Open queues that the Helper/Admin is assigned to help for.',
                inline: false
            },
            {
                name: 'Options',
                value: "`mute_notif: boolean` Don't notify users that have enabled notifications for queues assigned to a Helper/Admin.",
                inline: true
            },
            {
                name: 'Example Usage',
                value: '`/start`',
                inline: true
            },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '\u200B', value: '-'.repeat(30), inline: false },
            {
                name: '`/stop`',
                value: 'Close the OH-queue and stop students from entering the queue.\n\nStudents that were in the queue before closing will still be regisitered for OH and be in the queue for the next OH.',
                inline: false
            },
            {
                name: 'Options',
                value: "None",
                inline: true
            },
            {
                name: 'Example Usage',
                value: '`/stop`',
                inline: true
            },
            { name: '\u200B', value: '\u200B', inline: true },

        ]
    }],
};