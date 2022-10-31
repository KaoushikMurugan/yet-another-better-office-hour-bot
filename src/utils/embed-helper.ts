/** @module Utilities */

import {
    CommandInteraction,
    Interaction,
    BaseMessageOptions,
    TextBasedChannel,
    User,
    ApplicationCommandOptionType
} from 'discord.js';
import { QueueError, ServerError } from '../utils/error-types.js';
import { client } from '../global-states.js';

export enum EmbedColor {
    Success = 0xa9dc76, // Green
    Error = 0xff6188, // Red
    KindaBad = 0xfc9867, // Orange
    Neutral = 0xffffff, // White
    Warning = 0xffd866, // Yellow
    NoColor = 0x2f3137, // the embed background
    Aqua = 0x78dce8, // Aqua
    Purple = 0xa6a5c4,
    Pink = 0xffb7c5,
    Blue = 0x3498db
}

/**
 * Creates a simple embed that displays only displays text
 *
 * If the message is too long to fit into the title, it will be pushed to the
 * start of the description
 * @param message The message to display, will be in the title of the embed
 * @param color The color of the sidebar of the embed
 * @param description The description of the embed
 * @returns A message object that only contain the embed
 */
export function SimpleEmbed(
    message: string,
    color = EmbedColor.Neutral,
    description = ''
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL =
        client.user?.avatarURL() ?? 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png';
    if (message.length <= 256) {
        return {
            embeds: [
                {
                    color: color,
                    title: message,
                    timestamp: new Date().toISOString(),
                    description: description.slice(0, 4096),
                    author: {
                        name: 'YABOB',
                        icon_url: YABOB_PFP_URL
                    }
                }
            ]
        };
    } else {
        // temporary solution: Force the message into description
        return {
            embeds: [
                {
                    color: color,
                    description: (message + '\n\n' + description).slice(0, 4096),
                    timestamp: new Date().toISOString(),
                    author: {
                        name: 'YABOB',
                        icon_url: YABOB_PFP_URL
                    }
                }
            ]
        };
    }
}

/**
 * Creates an embed that displays an error message
 * @param err The error to display in the embed
 * @returns A message object that only contains the requested embed
 */
export function ErrorEmbed(err: Error): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL =
        client.user.avatarURL() ?? 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png';
    let color = EmbedColor.KindaBad;
    const embedFields = [
        {
            name: 'Error Type',
            value: err.name,
            inline: true
        }
    ];
    if (err instanceof QueueError) {
        color = EmbedColor.Aqua;
        embedFields.push({
            name: 'In Queue',
            value: err.queueName,
            inline: true
        });
    }
    if (err instanceof ServerError) {
        color = EmbedColor.Error;
    }
    return {
        embeds: [
            {
                color: color,
                title: err.message.length <= 256 ? err.message : err.name,
                timestamp: new Date().toISOString(),
                description: (
                    (err.message.length > 256 ? err.message : '') +
                    `If you need help or think this is a mistake, ` +
                    `please post a screenshot of this message in the #help channel ` +
                    `(or equivalent) and ping @Bot Admin.`
                ).slice(0, 1024),
                fields: embedFields,
                author: {
                    name: 'YABOB',
                    icon_url: YABOB_PFP_URL
                }
            }
        ]
    };
}

/**
 * Creates an error log embed
 * @param err The error to display in the embed
 * @param interaction The interaction that triggered the error
 * @returns A message object that only contains the requested embed
 */
export function ErrorLogEmbed(
    err: Error,
    interaction: Interaction
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL =
        client.user?.avatarURL() ?? 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png';
    let color = EmbedColor.KindaBad;
    const embedFields = [
        {
            name: 'User',
            value: interaction.user.toString(),
            inline: true
        },
        {
            name: 'Error Type',
            value: err.name,
            inline: true
        }
    ];
    if (err instanceof QueueError) {
        color = EmbedColor.Aqua;
        embedFields.push({
            name: 'In Queue',
            value: err.queueName,
            inline: true
        });
    }
    embedFields.push({
        name: 'Error Message',
        value: err.message.slice(0, 1024), // max 1024 characters
        inline: false
    });
    if (err instanceof ServerError) {
        color = EmbedColor.Error;
    }
    return {
        embeds: [
            {
                color: color,
                title: `Error occured at <t:${new Date()
                    .getTime()
                    .toString()
                    .slice(0, -3)}:F> `,
                timestamp: new Date().toISOString(),
                fields: embedFields,
                footer: {
                    text: 'YABOB',
                    icon_url: YABOB_PFP_URL
                }
            }
        ]
    };
}

/**
 * Creates a log embed that displays a message
 * @param message The message to display in the embed
 * @returns A message object that only contains the requested embed
 */
export function SimpleLogEmbed(message: string): Pick<BaseMessageOptions, 'embeds'> {
    const timeStampString = `\nat <t:${new Date().getTime().toString().slice(0, -3)}:F>`;
    const YABOB_PFP_URL =
        client.user?.avatarURL() ?? 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png';
    if (message.length <= 256) {
        return {
            embeds: [
                {
                    color: EmbedColor.NoColor,
                    title: message + timeStampString,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'YABOB',
                        icon_url: YABOB_PFP_URL
                    }
                }
            ]
        };
    } else {
        // temporary solution: Force the message into description
        return {
            embeds: [
                {
                    color: EmbedColor.NoColor,
                    description: message + timeStampString,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'YABOB',
                        icon_url: YABOB_PFP_URL
                    }
                }
            ]
        };
    }
}

/**
 * Creates a log embed for a button interaction
 * @param user The user who pressed the button
 * @param interactionName The name of the button interaction
 * @param channel The channel the button was pressed in
 * @returns A message object that only contains the log embed
 */
export function ButtonLogEmbed(
    user: User,
    interactionName: string,
    channel: TextBasedChannel
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL =
        client.user?.avatarURL() ?? 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png';
    return {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: `Button Pressed at <t:${new Date()
                    .getTime()
                    .toString()
                    .slice(0, -3)}:F>`,
                timestamp: new Date().toISOString(),
                fields: [
                    {
                        name: 'User',
                        value: user.toString(),
                        inline: true
                    },
                    {
                        name: 'Button Name',
                        value: interactionName,
                        inline: true
                    },
                    {
                        name: 'Channel',
                        value: channel.toString(),
                        inline: true
                    }
                ],
                footer: {
                    text: 'YABOB',
                    icon_url: YABOB_PFP_URL
                }
            }
        ]
    };
}

/**
 * Creates a log embed for a slash command interaction
 * @param commandInteraction The interaction to create the log embed for
 * @returns A message object that only contains the log embed
 */
export function SlashCommandLogEmbed(
    commandInteraction: CommandInteraction
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL =
        client.user?.avatarURL() ?? 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png';
    let commandName = commandInteraction.commandName;
    let optionsData = commandInteraction.options.data;
    if (optionsData[0]?.type === ApplicationCommandOptionType.Subcommand) {
        // TODO: add condition for subcommand group later
        commandName += ` ${optionsData[0].name}`;
        optionsData = optionsData[0].options ?? [];
    }
    const embedFields = [
        {
            name: 'User',
            value: commandInteraction.user.toString(),
            inline: true
        },
        {
            name: 'Command Name',
            value: `\`/${commandName}\``,
            inline: true
        },
        {
            name: 'Channel',
            value: commandInteraction.channel?.toString() ?? `unknown channel`,
            inline: true
        }
    ];
    if (optionsData.length > 0) {
        embedFields.push({
            name: 'Options',
            // Need to manually format the options as they are parsed as a string | number | boolean | undefined
            value: optionsData
                .map(option => {
                    switch (option.type) {
                        case ApplicationCommandOptionType.Channel:
                            return `**${option.name}**: <#${option.value}>`;
                        case ApplicationCommandOptionType.User ||
                            ApplicationCommandOptionType.Role ||
                            ApplicationCommandOptionType.Mentionable:
                            return `**${option.name}**: <@${option.value}>`;
                        default:
                            return `**${option.name}**: ${option.value}`;
                    }
                })
                .join('\n')
                .slice(0, 1024), // max 1024 chars for 1 field
            inline: false
        });
    }
    return {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: `Slash Command Used at <t:${new Date()
                    .getTime()
                    .toString()
                    .slice(0, -3)}:F>`,
                timestamp: new Date().toISOString(),
                fields: embedFields,
                footer: {
                    text: 'YABOB',
                    icon_url: YABOB_PFP_URL
                }
            }
        ]
    };
}
