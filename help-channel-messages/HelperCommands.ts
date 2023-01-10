import { client } from '../src/global-states.js';
import { EmbedColor } from '../src/utils/embed-helper.js';
import { HelpMessage } from '../src/utils/type-aliases.js';

const helperCommandsTitleMessage: HelpMessage = {
    nameValuePair: {
        name: 'Staff Commands Title',
        value: 'helper-commands-title'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.Neutral,
                title: 'Bot Admin & Staff Only Commands',
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
                        value: 'Stops tracking hours for caller and marks them internally as not helping. Closes queues which no longer have an active helper\
                        \n\nStudents that were in the queue before closing will still be registered for OH and be in the queue for the next OH.',
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
                        value: 'Sends a message to all the students waiting in the queues that you are currently helping.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`queue_name: Channel`\nSends the message to only those in a queue specified in`queue_name`',
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
    useInHelpCommand: false,
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

const pauseHelp: HelpMessage = {
    nameValuePair: {
        name: 'pause',
        value: 'pause'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/pause`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Marks a staff member as "paused helping". If all the helpers of a queue paused helping, that queue enters a "paused" state where students cannot enter the queue anymore, but can still be dequeued',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: 'None',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/pause`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const resumeHelp: HelpMessage = {
    nameValuePair: {
        name: 'resume',
        value: 'resume'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/resume`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Marks a staff member as "active" after they used `/pause`.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: 'None',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/resume`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const helperCommandHelpMessages: HelpMessage[] = [
    helperCommandsTitleMessage,
    startHelp,
    stopHelp,
    nextHelp,
    announceHelp,
    // ! Over choice limit
    clearHelp,
    pauseHelp,
    resumeHelp
];

export { helperCommandHelpMessages };
