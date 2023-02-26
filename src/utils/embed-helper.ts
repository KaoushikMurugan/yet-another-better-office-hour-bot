/** @module Utilities */

import {
    CommandInteraction,
    Interaction,
    BaseMessageOptions,
    TextBasedChannel,
    User,
    ApplicationCommandOptionType,
    EmbedBuilder,
    ActionRowComponentOptions,
    MessageActionRowComponentData,
    ActionRowData,
    MessageActionRowComponentBuilder,
    Attachment,
    AttachmentBuilder,
    AttachmentPayload
} from 'discord.js';
import { CommandParseError, QueueError, ServerError } from '../utils/error-types.js';
import { client } from '../global-states.js';
import { OptionalRoleId, SpecialRoleValues } from './type-aliases.js';

type ExpectedError = QueueError | ServerError | CommandParseError;

/** Shorthand type for the embed field data */
type EmbedData = Pick<BaseMessageOptions, 'embeds'>;

class BetterEmbed implements BaseMessageOptions {
    embeds: EmbedBuilder[] = [];
    files?: (
        | Attachment
        | AttachmentBuilder
        | AttachmentPayload
    )[];
    content?: string;
    components?: ActionRowData<MessageActionRowComponentData | MessageActionRowComponentBuilder>[];
    constructor() {
        this.embeds = [];
    }
    addFields(fields: { name: string; value: string; inline?: boolean }[]): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].addFields(fields);
        return this;
    }
    addDescription(description: string): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].setDescription(description);
        return this;
    }
    addFooter(text: string, iconURL?: string): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].setFooter({
                text: text,
                iconURL: iconURL
        });
        return this;
    }
    addTimestamp(): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].setTimestamp();
        return this;
    }
    addAuthor(name: string, iconURL?: string, url?: string): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].setAuthor({
                name: name,
                iconURL: iconURL,
                url: url
        });
        return this;
    }
    setColor(color: number): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].setColor(color);
        return this;
    }
    setTitle(title: string): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].setTitle(title);
        return this;
    }
    setImage(url: string): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].setImage(url);
        return this;
    }
    setThumbnail(url: string): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].setThumbnail(url);
        return this;
    }
    setURL(url: string): BetterEmbed {
        if(!this.embeds[0]) throw new Error('No embeds to add field to'); 
        this.embeds[0].setURL(url);
        return this;
    }
    addFile(file: Attachment | AttachmentBuilder | AttachmentPayload): BetterEmbed {
        this.files = this.files ?? [];
        this.files.push(file);
        return this;
    }
    addFiles(files: (Attachment | AttachmentBuilder | AttachmentPayload)[]): BetterEmbed {
        this.files = this.files ?? [];
        this.files.push(...files);
        return this;
    }
    setContent(content: string): BetterEmbed {
        this.content = content;
        return this;
    }
    addComponents(components: ActionRowData<MessageActionRowComponentData | MessageActionRowComponentBuilder>[]): BetterEmbed {
        this.components = components;
        return this;
    }
    getFields(): { name: string; value: string; inline?: boolean }[] {
        if(!this.embeds[0]) throw new Error('Embed doesn\'t exist'); 
        const embedDataFields = this.embeds[0].data.fields;
        return embedDataFields?.map(
            field => { return {
                name: field.name,
                value: field.value,
                inline: field.inline
            };
        }) ?? [];
    }
    
}

enum EmbedColor {
    Error = 0xff6188, // Red
    KindaBad = 0xfc9867, // Orange
    Success = 0xa9dc76, // Green
    UnexpectedError = 0xff0000, // pure red
    Neutral = 0xffffff, // White
    Yellow = 0xffd866, // Yellow
    NoColor = 0x2f3137, // the embed background
    Aqua = 0x78dce8,
    DiscordPurple = 0x5865f2,
    PastelPurple = 0x738adb, // old discord purple
    Pink = 0xffb7c5,
    Blue = 0x3084fe
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
    description = '',
    warning = ''
): EmbedData {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    if (message.length <= 256) {
        return {
            embeds: [
                {
                    color: color,
                    title: message,
                    timestamp: new Date().toISOString(),
                    description: description.slice(0, 4096),
                    fields:
                        warning.length > 0 ? [{ name: 'Warning', value: warning }] : [],
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
                    fields:
                        warning.length > 0 ? [{ name: 'Warning', value: warning }] : [],
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
    description = '',
    warning = ''
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
    if (warning.length > 0) {
        embed.addFields({
            name: 'Warning',
            value: warning
        });
    }

    return embed;
}

let asdf = SimpleEmbed2('asdf', EmbedColor.Neutral, 'asdf', 'asdf');
interaction.reply(asdf.data);

/**
 * Creates an embed that displays an error message
 * @param err The error to display in the embed
 * @param pingForHelp role id of the person to ping for help. **Could be NotSet or Deleted**
 * @param descriptionOverride a string that provides additional help message. If not specified, the default message will be used.
 * @returns The embed with formatted error message
 */
function ErrorEmbed(err: ExpectedError | Error, pingForHelp: OptionalRoleId): EmbedData {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    const embed = new EmbedBuilder();
    let color = EmbedColor.UnexpectedError;
    // use tagged union to avoid the expensive instanceof check
    // @see https://mariusschulz.com/blog/tagged-union-types-in-typescript
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
        embed.addFields({
            name: 'Error Type',
            value: err.type
        });
    }
    const defaultErrorDescription = [
        err.message.length > 256 ? `${err.message}\n` : '',
        `If you need help or think this is a mistake, `,
        `please post a screenshot of this message in the #help channel (or equivalent) and `,
        pingForHelp in SpecialRoleValues
            ? `show this message to a Bot Admin by pinging @Bot Admin (or equivalent).`
            : `contact <@&${pingForHelp}>.`
    ].join('');
    embed
        // Temporary solution, if message is too long, show the error name in the title
        .setTitle(err.message.length <= 256 ? err.message : err.name)
        .setTimestamp(new Date())
        .setAuthor({ name: 'YABOB', iconURL: YABOB_PFP_URL })
        .setDescription(
            'description' in err
                ? err.description?.slice(0, 4096) ?? defaultErrorDescription
                : defaultErrorDescription
        )
        .setColor(color);
    return { embeds: [embed.data] };
}

/**
 * Creates an error log embed
 * @param err The error to display in the embed
 * @param interaction The interaction that triggered the error
 * @returns A message object that only contains the requested embed
 */
function ErrorLogEmbed(err: Error, interaction: Interaction): EmbedData {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
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
    let color = EmbedColor.KindaBad;
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
                title: `Error occurred at <t:${new Date()
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

function ErrorLogEmbed2(err: ExpectedError | Error, interaction: Interaction): EmbedData {
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
    let color: EmbedColor = EmbedColor.UnexpectedError;
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
    }
    const embed = new EmbedBuilder()
        .setTitle(
            `Error occurred at <t:${new Date().getTime().toString().slice(0, -3)}:F> `
        )
        .setColor(color)
        .setTimestamp(new Date())
        .setFields(fields)
        .setFooter({
            text: 'YABOB',
            iconURL: YABOB_PFP_URL
        });
    return { embeds: [embed.data] };
}

/**
 * Creates a log embed that displays a message
 * @param message The message to display in the embed
 * @returns A message object that only contains the requested embed
 */
function SimpleLogEmbed(message: string): EmbedData {
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

function SimpleLogEmbed2(message: string): EmbedData {
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
    return { embeds: [embed.data] };
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
): EmbedData {
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
): EmbedData {
    const YABOB_PFP_URL = client.user.avatarURL() ?? DEFAULT_PFP;
    const embed = new EmbedBuilder()
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
    return { embeds: [embed.data] };
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
): EmbedData {
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
function SlashCommandLogEmbed(commandInteraction: CommandInteraction): EmbedData {
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
                        // fall through cases, allows User, Role, and Mentionable to be matched together
                        // this is pretty error prone, so we generally avoid doing this
                        // but in this case it's safe because we always return
                        case ApplicationCommandOptionType.User:
                        case ApplicationCommandOptionType.Role:
                        case ApplicationCommandOptionType.Mentionable:
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
                        // see the SlashCommandLogEmbed's comments
                        case ApplicationCommandOptionType.User:
                        case ApplicationCommandOptionType.Role:
                        case ApplicationCommandOptionType.Mentionable:
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
    BetterEmbed,
    SimpleEmbed,
    SimpleEmbed2,
    SimpleLogEmbed,
    SimpleLogEmbed2,
    ErrorEmbed,
    ErrorLogEmbed,
    ErrorLogEmbed2,
    ButtonLogEmbed,
    ButtonLogEmbed2,
    SlashCommandLogEmbed,
    SlashCommandLogEmbed2,
    SelectMenuLogEmbed,
    SelectMenuLogEmbed2
};
