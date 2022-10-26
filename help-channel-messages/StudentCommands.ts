import { client } from '../src/global-states';
import { EmbedColor } from '../src/utils/embed-helper';
import { HelpMessage } from '../src/utils/type-aliases';

const studentCommandsTileMessage: HelpMessage = {
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
                    icon_url: client.user?.avatarURL() ?? 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
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
                        value: 'None',
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
    }
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
    }
};

const listHelpersHelp: HelpMessage = {
    nameValuePair: {
        name: 'list_helpers',
        value: 'list helpers'
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
    }
};

const studentCommandHelpMessages: HelpMessage[] = [
    studentCommandsTileMessage,
    enqueueHelp,
    leaveHelp,
    listHelpersHelp
];

export { studentCommandHelpMessages };
