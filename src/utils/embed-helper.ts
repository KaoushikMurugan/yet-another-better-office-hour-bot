/** @module Utilities */

import {
    CommandInteraction,
    Interaction,
    BaseMessageOptions,
    TextBasedChannel,
    User,
    ApplicationCommandOptionType,
    EmbedBuilder,
    Snowflake
} from 'discord.js';
import { CommandParseError, QueueError, ServerError } from '../utils/error-types.js';
import { client } from '../global-states.js';

type ExpectedError = QueueError | ServerError | CommandParseError;

enum EmbedColor {
    Success = 0xa9dc76, // Green
    Error = 0xff6188, // Red
    UnexpectedError = 0xff0000, // pure red
    KindaBad = 0xfc9867, // Orange
    Neutral = 0xffffff, // White
    Yellow = 0xffd866, // Yellow
    NoColor = 0x2f3137, // the embed background
    Aqua = 0x78dce8,
    Purple = 0xa6a5c4,
    Pink = 0xffb7c5,
    Blue = 0x3498db
}

const DEFAULT_PFP = 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png' as const;

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
function SimpleEmbed(
    message: string,
    color = EmbedColor.Neutral,
    description = ''
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
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

/** Embed builder variant of Simple Embed */
function SimpleEmbed2(
    message: string,
    color = EmbedColor.Neutral,
    description = ''
): EmbedBuilder {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: 'YABOB',
            iconURL: YABOB_PFP_URL
        })
        .setTimestamp(new Date());
    if (message.length > 256) {
        embed.setDescription((message + '\n\n' + description).slice(0, 4096));
    } else {
        embed.setTitle(message);
        if (description.length > 0) {
            embed.setDescription(description.slice(0, 4096));
        }
    }
    return embed;
}

/**
 * Creates an embed that displays an error message
 * @param err The error to display in the embed
 * @param pingForHelp role id of the person to ping for help
 * @returns A message object that only contains the requested embed
 */
function ErrorEmbed(
    err: Error,
    pingForHelp?: Snowflake
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
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
                    `(or equivalent) and ping ` +
                    (pingForHelp === undefined
                        ? `Please show this message to a Bot Admin by pinging @Bot Admin (or equivalent).`
                        : `<@&${pingForHelp}>.`)
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

function ErrorEmbed2(err: ExpectedError | Error, pingForHelp?: Snowflake): EmbedBuilder {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    const embed = new EmbedBuilder();
    let color: EmbedColor;
    // use discriminated union to avoid the instanceof check
    if ('type' in err) {
        switch (err.type) {
            case 'ServerError':
                color = EmbedColor.Error;
                break;
            case 'QueueError':
                color = EmbedColor.Aqua;
                embed.addFields({
                    name: 'In Queue',
                    value: err.queueName,
                    inline: true
                });
                break;
            case 'CommandParseError':
                color = EmbedColor.KindaBad;
                break;
        }
    } else {
        color = EmbedColor.UnexpectedError;
    }
    return embed
        .setTitle(err.message.length <= 256 ? err.message : err.name)
        .setTimestamp(new Date())
        .setAuthor({ name: 'YABOB', iconURL: YABOB_PFP_URL })
        .setDescription(
            (err.message.length > 256 ? `${err.message}\n` : '') +
                `If you need help or think this is a mistake, ` +
                `please post a screenshot of this message in the #help channel ` +
                `(or equivalent) and ping ` +
                pingForHelp
                ? `<@&${pingForHelp}>.`
                : `Please show this message to a Bot Admin by pinging @Bot Admin (or equivalent).`
        )
        .setColor(color);
}

/**
 * Creates an error log embed
 * @param err The error to display in the embed
 * @param interaction The interaction that triggered the error
 * @returns A message object that only contains the requested embed
 */
function ErrorLogEmbed(
    err: Error,
    interaction: Interaction
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
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

function ErrorLogEmbed2(
    err: ExpectedError | Error,
    interaction: Interaction
): EmbedBuilder {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    const fields = [
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
    let color: EmbedColor;
    if ('type' in err) {
        switch (err.type) {
            case 'ServerError':
                color = EmbedColor.Error;
                break;
            case 'QueueError':
                color = EmbedColor.Aqua;
                fields.push({
                    name: 'In Queue',
                    value: err.queueName,
                    inline: true
                });
                break;
            case 'CommandParseError':
                color = EmbedColor.KindaBad;
                break;
        }
    } else {
        color = EmbedColor.UnexpectedError;
    }
    return new EmbedBuilder()
        .setTitle(
            `Error occured at <t:${new Date().getTime().toString().slice(0, -3)}:F> `
        )
        .setColor(color)
        .setTimestamp(new Date())
        .setFields(fields)
        .setFooter({
            text: 'YABOB',
            iconURL: YABOB_PFP_URL
        });
}

/**
 * Creates a log embed that displays a message
 * @param message The message to display in the embed
 * @returns A message object that only contains the requested embed
 */
function SimpleLogEmbed(message: string): Pick<BaseMessageOptions, 'embeds'> {
    const timeStampString = `\nat <t:${new Date().getTime().toString().slice(0, -3)}:F>`;
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
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

function SimpleLogEmbed2(message: string): EmbedBuilder {
    const timeStampString = `at <t:${new Date().getTime().toString().slice(0, -3)}:F>`;
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    const embed = new EmbedBuilder()
        .setColor(EmbedColor.NoColor)
        .setAuthor({
            name: 'YABOB',
            iconURL: YABOB_PFP_URL
        })
        .setTimestamp(new Date())
        .setFooter({
            text: 'YABOB',
            iconURL: YABOB_PFP_URL
        });
    message.length >= 256
        ? embed.setDescription(`${message.slice(0, 4096)}\n${timeStampString}`)
        : embed.setTitle(message);
    return embed;
}

/**
 * Creates a log embed for a button interaction
 * @param user The user who pressed the button
 * @param buttonName The name of the button interaction
 * @param channel The channel the button was pressed in
 * @returns A message object that only contains the log embed
 */
function ButtonLogEmbed(
    user: User,
    buttonName: string,
    channel: TextBasedChannel
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
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
                        value: buttonName,
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

function ButtonLogEmbed2(
    user: User,
    buttonName: string,
    channel: TextBasedChannel
): EmbedBuilder {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    return new EmbedBuilder()
        .setTitle(
            `Button Pressed at <t:${new Date().getTime().toString().slice(0, -3)}:F>`
        )
        .setColor(EmbedColor.NoColor)
        .setTimestamp(new Date())
        .setFields(
            {
                name: 'User',
                value: user.toString(),
                inline: true
            },
            {
                name: 'Button Name',
                value: buttonName,
                inline: true
            },
            {
                name: 'Channel',
                value: channel.toString(),
                inline: true
            }
        )
        .setFooter({
            text: 'YABOB',
            iconURL: YABOB_PFP_URL
        });
}

/**
 * Creates a log embed for a select menu interaction
 * @param user The user who selected an option
 * @param selectMenuName The name of the select menu interaction
 * @param optionSelected The option the user selected
 * @param channel The channel the select menu was used in
 * @returns A message object that only contains the log embed
 */
function SelectMenuLogEmbed(
    user: User,
    selectMenuName: string,
    optionSelected: string[],
    channel: TextBasedChannel
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    return {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: `Select Menu option was selected at <t:${new Date()
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
                        name: 'Select Menu Name',
                        value: selectMenuName,
                        inline: true
                    },
                    {
                        name: 'Option(s) Selected',
                        value: optionSelected.join(', '),
                        inline: true
                    },
                    {
                        name: 'Channel',
                        value: channel.toString(),
                        inline: false
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
function SlashCommandLogEmbed(
    commandInteraction: CommandInteraction
): Pick<BaseMessageOptions, 'embeds'> {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
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

function SlashCommandLogEmbed2(command: CommandInteraction): EmbedBuilder {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    const subCommandStr = command.options.data[0];
    const embed = new EmbedBuilder()
        .setFields(
            {
                name: 'User',
                value: command.user.toString(),
                inline: true
            },
            {
                name: 'Command Name',
                value: `\`/${command.commandName} ${
                    subCommandStr?.type === ApplicationCommandOptionType.Subcommand
                        ? subCommandStr
                        : ''
                }\``,
                inline: true
            },
            {
                name: 'Channel',
                value: command.channel?.toString() ?? 'Unknown Channel',
                inline: true
            }
        )
        .setFooter({
            text: 'YABOB',
            iconURL: YABOB_PFP_URL
        });
    if (command.options.data.length > 0) {
        embed.addFields({
            name: 'Options',
            // Need to manually format the options as they are parsed as a string | number | boolean | undefined
            value: command.options.data
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
    return embed;
}

function SelectMenuLogEmbed2(
    user: User,
    selectMenuName: string,
    optionSelected: string[],
    channel: TextBasedChannel
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(EmbedColor.NoColor)
        .setTitle(
            `Select Menu option was selected at <t:${new Date()
                .getTime()
                .toString()
                .slice(0, -3)}:F>`
        )
        .setTimestamp(new Date())
        .setFields(
            {
                name: 'User',
                value: user.toString(),
                inline: true
            },
            {
                name: 'Select Menu Name',
                value: selectMenuName,
                inline: true
            },
            {
                name: 'Option(s) Selected',
                value: optionSelected.join(', '),
                inline: true
            },
            {
                name: 'Channel',
                value: channel.toString(),
                inline: false
            }
        )
        .setFooter({
            text: 'YABOB',
            iconURL: client.user.avatarURL() ?? DEFAULT_PFP
        });
}

export {
    EmbedColor,
    SimpleEmbed,
    SimpleEmbed2,
    SimpleLogEmbed,
    SimpleLogEmbed2,
    ErrorEmbed,
    ErrorEmbed2,
    ErrorLogEmbed,
    ErrorLogEmbed2,
    ButtonLogEmbed,
    ButtonLogEmbed2,
    SlashCommandLogEmbed,
    SlashCommandLogEmbed2,
    SelectMenuLogEmbed,
    SelectMenuLogEmbed2
};
