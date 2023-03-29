import { client } from '../src/global-states.js';
import { EmbedColor } from '../src/utils/embed-helper.js';
import { HelpMessage } from '../src/utils/type-aliases.js';

const adminCommandsTitleMessage: HelpMessage = {
    nameValuePair: {
        name: 'Admin Commands Title',
        value: 'admin-commands-title'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.Neutral,
                title: 'Bot Admin Only Commands',
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

const queueAddHelp: HelpMessage = {
    nameValuePair: {
        name: 'queue add',
        value: 'queue-add'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
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
                    {
                        name: 'Example Usage',
                        value: '`/queue add New Queue`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '📝'
};

const queueRemoveHelp: HelpMessage = {
    nameValuePair: {
        name: 'queue remove',
        value: 'queue_remove'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
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
                    {
                        name: 'Example Usage',
                        value: '`/queue remove Existing Queue`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '🗑️'
};

const cleanupQueueHelp: HelpMessage = {
    nameValuePair: {
        name: 'cleanup_queue',
        value: 'cleanup_queue'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/cleanup_queue (queue_name)`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Debug feature. Cleans up everything in #queue for the specified queue and re-sends new embeds.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`queue_name: Channel`\nThe queue to clean',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/cleanup class A`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '🧹'
};

const cleanupHelpChannelHelp: HelpMessage = {
    nameValuePair: {
        name: 'clean_up_help_channel',
        value: 'clean_up_help_channel'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/clean_up_help_channel`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Debug feature. Cleans up all the bot help channels and re-sends new embeds'
                    },
                    {
                        name: 'Options',
                        value: 'None',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/clean_up_help_channel`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '🧹'
};

const clearAllHelp: HelpMessage = {
    nameValuePair: {
        name: 'clear_all',
        value: 'clear_all'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
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
                    {
                        name: 'Example Usage',
                        value: '`/clear_all`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '🧹'
};

const setLoggingChannelHelp: HelpMessage = {
    nameValuePair: {
        name: 'set_logging_channel',
        value: 'set_logging_channel'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/set_logging_channel [channel]`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Sets the channel where the bot will log all of its actions.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`channel: Channel`\nThe channel where you want YABOB to log to.',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/set_logging_channel #logging`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '🪵'
};

const stopLoggingHelp: HelpMessage = {
    nameValuePair: {
        name: 'stop_logging',
        value: 'stop_logging'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/stop_logging`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Stops the bot from logging to the channel set by `/set_logging_channel`.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: 'None',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/stop_logging`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '🪵'
};

const settingsHelp: HelpMessage = {
    nameValuePair: {
        name: 'settings',
        value: 'settings'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/settings`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Displays a server settings menu. This menu allows you to change \
                        the a variety of settings of the bot for your server.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`sub_menu_jump: string`: Jump to a specific sub menu.',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/settings`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '⚙️'
};

const createOfficesHelp: HelpMessage = {
    nameValuePair: {
        name: 'create_offices',
        value: 'create_offices'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/create_offices`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Creates the office hours channels for the server. This command will create \
                        the voice channels and set the appropriate permissions.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`category_name: string` The name of the category to create the voice channels in. \n\
                        `office_names: string` The name of the voice channels to create. Will be created as office_name-1, office_name-2 etc. \n\
                        `number_of_offices: number` The number of offices to create.',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/create_offices "Office Hours" "Office" 3`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '🔊'
};

const setRoleHelp: HelpMessage = {
    nameValuePair: {
        name: 'set_role',
        value: 'set_role'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/set_role`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Sets the role(s) for the server to use for `Bot Admin`, `Helper` and `Student` roles.'
                    },
                    {
                        name: 'Options',
                        value: '`role_name: [Bot Admin | Staff | Studnet]`: The name of the role to set. \n\
                        `role: Role`: The role to set the chosen role to.'
                    },
                    {
                        name: 'Example Usage',
                        value: '`/set_role Bot Admin @Moderator`'
                    }
                ]
            }
        ]
    },
    emoji: '👥'
};

const adminCommandHelpMessages: HelpMessage[] = [
    adminCommandsTitleMessage,
    queueAddHelp,
    queueRemoveHelp,
    cleanupQueueHelp,
    cleanupHelpChannelHelp,
    clearAllHelp,
    setLoggingChannelHelp,
    stopLoggingHelp,
    settingsHelp,
    createOfficesHelp,
    setRoleHelp
];

export { adminCommandHelpMessages };
