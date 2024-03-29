import { client } from '../global-states.js';
import { EmbedColor } from '../utils/embed-helper.js';
import { HelpMessage } from '../utils/type-aliases.js';

const studentCommandsTitleMessage: HelpMessage = {
    nameValuePair: {
        name: 'Student Commands Title',
        value: 'student-commands-title'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.Neutral,
                title: 'Commands Available To Everyone (Admin, Helper, Student)',
                timestamp: new Date().toISOString(),
                author: {
                    name: 'YABOB V4.',
                    icon_url:
                        client.user.avatarURL() ??
                        'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
                }
            }
        ]
    }
};

const enqueueHelp: HelpMessage = {
    nameValuePair: {
        name: 'enqueue',
        value: 'enqueue'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
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
                        value: '`queue_name: string`\nName of the queue to add the sender to',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/enqueue ECS32A`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '➕'
};

const leaveHelp: HelpMessage = {
    nameValuePair: {
        name: 'leave',
        value: 'leave'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
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
                        value: 'None',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/leave`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '❌'
};

const listHelpersHelp: HelpMessage = {
    nameValuePair: {
        name: 'list_helpers',
        value: 'list_helpers'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
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
                        value: 'None',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/list_helpers`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '👨‍🏫'
};

const queueNotifyHelp: HelpMessage = {
    nameValuePair: {
        name: 'queue_notify',
        value: 'queue_notify'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/queue_notify [queue_name] [on|off]]`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Toggles whether the sender will be notified when they are next in line for the queue `queue_name`',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`queue_name: string`\nName of the queue to toggle the notification for\n\n`on|off: string`\nWhether to turn the notification on or off',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/queue_notify ECS32A`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '🔔'
};

const helpHelp: HelpMessage = {
    nameValuePair: {
        name: 'help',
        value: 'help'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/help [command_name]`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Displays the help message for the command `command_name`.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`command_name: string`\nName of the command to display the help message for.\
                        \nNote: After typing /help, the command option will show the list of commands available to search through',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/help enqueue`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '❓'
};

const studentCommandHelpMessages: HelpMessage[] = [
    studentCommandsTitleMessage,
    enqueueHelp,
    leaveHelp,
    listHelpersHelp,
    queueNotifyHelp,
    helpHelp
];

export { studentCommandHelpMessages };
