import { MessageOptions } from "discord.js";
import { EmbedColor } from "../src/utils/embed-helper";
import { HelpMessage } from "../src/utils/type-aliases";


const studentCommandsTileMessage: MessageOptions = {
    embeds: [{
        color: EmbedColor.Neutral,
        title: 'Commands Available To Everyone (Admin, Helper, Student)',
        timestamp: new Date(),
        author: {
            name: 'YABOB V4.',
            iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
        }
    }]
}

const enqueueHelp: HelpMessage = {
    nameValuePair: ["enqueue", "enqueue"],
    message: {
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
    }
};

const leaveHelp: HelpMessage = {
    nameValuePair: ["leave", "leave"],
    message: {
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
    }
};

const listHelpersHelp: HelpMessage = {
    nameValuePair: ["list_helpers", "list helpers"],
    message: {
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
};

const studentHelpChannelEmbeds: Pick<MessageOptions, "embeds">[] = [
    studentCommandsTileMessage,
    enqueueHelp.message,
    leaveHelp.message,
    listHelpersHelp.message,
];

const studentCommandHelpMessages: HelpMessage[] = [
    enqueueHelp,
    leaveHelp,
    listHelpersHelp,
];

export { studentHelpChannelEmbeds, studentCommandHelpMessages };