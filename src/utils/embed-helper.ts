import { CommandInteraction, Interaction, MessageOptions, TextBasedChannel, User } from 'discord.js';
import {
    QueueError,
    ServerError,
    UserViewableError
} from '../utils/error-types';

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
}

export function SimpleEmbed(
    message: string,
    color = EmbedColor.Neutral,
    description = '',
): Pick<MessageOptions, 'embeds'> {
    if (message.length <= 256) {
        return {
            embeds: [{
                color: color,
                title: message,
                timestamp: new Date(),
                description: description,
                author: {
                    name: 'YABOB',
                    iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
                },
            }],
        };
    } else { // temporary solution: Force the message into description
        return {
            embeds: [{
                color: color,
                description: message + '\n\n' + description,
                timestamp: new Date(),
                author: {
                    name: 'YABOB',
                    iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
                },
            }],
        };
    }
}

export function ErrorEmbed(err: UserViewableError): Pick<MessageOptions, 'embeds'> {
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
        embeds: [{
            color: color,
            title: err.message,
            timestamp: new Date(),
            description: `If you need help or think this is a mistake, `
                + `please post a screenshot of this message in the #help channel `
                + `(or equivalent) and ping @Bot Admin.`,
            fields: embedFields
        }],
    };
}

export function ErrorLogEmbed(err: Error, interaction: Interaction): Pick<MessageOptions, 'embeds'> {
    let color = EmbedColor.KindaBad;
    const embedFields = [
        {
            name: 'User',
            value: interaction.user.toString(),
            inline: true,
        },
        {
            name: 'Error Type',
            value: err.name,
            inline: true
        },
    ];
    if (err instanceof QueueError) {
        color = EmbedColor.Aqua;
        embedFields.push({
            name: 'In Queue',
            value: err.queueName,
            inline: true
        });
    }
    embedFields.push(
        {
            name: 'Error Message',
            value: err.message,
            inline: false
        });
    if (err instanceof ServerError) {
        color = EmbedColor.Error;
    }
    return {
        embeds: [{
            color: color,
            title: `Error occured at <t:${new Date().getTime().toString().slice(0, -3)}:F> `,
            timestamp: new Date(),
            fields: embedFields,
            footer: {
                text: `YABOB`,
                iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
            }
        }],
    };
}

export function SimpleLogEmbed(
    message: string
): Pick<MessageOptions, 'embeds'> {
    const timeStampString = `\nat <t:${new Date().getTime().toString().slice(0, -3)}:F>`;
    if (message.length <= 256) {
        return {
            embeds: [{
                color: EmbedColor.Pink,
                title: message + timeStampString,
                timestamp: new Date(),
                footer: {
                    text: `YABOB`,
                    iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
                }
            }],
        };
    } else { // temporary solution: Force the message into description
        return {
            embeds: [{
                color: EmbedColor.Pink,
                description: message + timeStampString,
                timestamp: new Date(),
                footer: {
                    text: `YABOB`,
                    iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
                }
            }],

        };
    }
}

export function ButtonLogEmbed(
    user: User,
    interactionName: string,
    channel: TextBasedChannel,
): Pick<MessageOptions, 'embeds'> {
    return {
        embeds: [{
            color: EmbedColor.Pink,
            title: `Button Pressed at <t:${new Date().getTime().toString().slice(0, -3)}:F>`,
            timestamp: new Date(),
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
                text: `YABOB`,
                iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
            }
        }],
    };
}

export function SlashCommandLogEmbed(
    commandInteraction: CommandInteraction,
): Pick<MessageOptions, 'embeds'> {
    let commandName = commandInteraction.commandName;
    let optionsData = commandInteraction.options.data;
    if (optionsData[0]?.type === 'SUB_COMMAND') { // add condition for subcommand group later
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
            value: optionsData.map((option) => {
                switch (option.type) {
                    case 'CHANNEL':
                        return `**${option.name}**: <#${option.value}>`;
                    case 'USER' || 'ROLE' || 'MENTIONABLE':
                        return `**${option.name}**: <@${option.value}>`;
                    default:
                        return `**${option.name}**: ${option.value}`;
                }
            }).join('\n'),
            inline: false
        });
    }
    return {
        embeds: [{
            color: EmbedColor.Pink,
            title: `Slash Command Used at <t:${new Date().getTime().toString().slice(0, -3)}:F>`,
            timestamp: new Date(),
            fields: embedFields,
            footer: {
                text: `YABOB`,
                iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
            }
        }],
    };
}
