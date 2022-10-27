import { client } from '../src/global-states';
import { EmbedColor } from '../src/utils/embed-helper';
import { HelpMessage } from '../src/utils/type-aliases';

const helperCommandsTileMessage: HelpMessage = {
    nameValuePair: {
        name: 'Helper Commands Title',
        value: 'helper-commands-title'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.Neutral,
                title: 'Bot Admin & Helper Only Commands',
                timestamp: new Date().toISOString(),
                author: {
                    name: 'YABOB V4.',
                    icon_url:
                        client.user?.avatarURL() ??
                        'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
                }
            }
        ]
    }
};

const startHelp: HelpMessage = {
    nameValuePair: {
        name: 'start',
        value: 'start'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
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
                        value: "`mute_notif: boolean`\nDon't notify users that have enabled notifications for queues assigned to the caller.",
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/start`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const stopHelp: HelpMessage = {
    nameValuePair: {
        name: 'stop',
        value: 'stop'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/stop`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Stops tracking hours for caller and marks them interally as not helping. Closes queues which no longer have an active helper\
                        \n\nStudents that were in the queue before closing will still be regisitered for OH and be in the queue for the next OH.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: 'None',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/stop`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const nextHelp: HelpMessage = {
    nameValuePair: {
        name: 'next',
        value: 'next'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
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
                        value: '`queue_name: Channel`\nDequeue the first student from a particular queue\n\n`user: User`\nDequeue a specific user.',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/next`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const announceHelp: HelpMessage = {
    nameValuePair: {
        name: 'announce',
        value: 'announce'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/announce [message] (queue_name)`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Sends a messeage to all helpees waiting in the queues that you are currently helping.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`queue_name: Channel`\nSends the message to only those in a queue specficied in`queue_name`',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/announce some announcement`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const clearHelp: HelpMessage = {
    nameValuePair: {
        name: 'clear',
        value: 'clear'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/clear (queue_name)`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Empties a queue of students. You can only clear a queue that you are a helper for. Bot Admins can clear any queue.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`queue_name: Channel`\nThe queue to clear',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/clear class A`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const helperCommandHelpMessages: HelpMessage[] = [
    helperCommandsTileMessage,
    startHelp,
    stopHelp,
    nextHelp,
    announceHelp,
    clearHelp
];

export { helperCommandHelpMessages };
