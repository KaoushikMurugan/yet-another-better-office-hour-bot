import { MessageOptions, TextBasedChannel, TextChannel, User } from "discord.js";
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
                + `and ping @Bot Admin.`,
            author: {
                name: 'YABOB',
                iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
            },
            fields: embedFields
        }],
    };
}

export function buttonLogEmbed(
    user: User,
    interactionName: string,
    channel: TextBasedChannel,
): Pick<MessageOptions, 'embeds'> {
    return {
        embeds: [{
            color: EmbedColor.Aqua,
            title: `Button Pressed at <t:${new Date().getTime().toString().slice(0, -3)}:F>`,
            timestamp: new Date(),
            fields: [
                {
                    name: "User",
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
            author: {
                name: 'YABOB',
                iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
            },
        }],
    };
}

export function slashCommandLogEmbed(
    user: User,
    commandName: string,
    optionData: {
        name: string,
        value: any,
        type: string
    } [],
    channel: TextBasedChannel,
): Pick<MessageOptions, 'embeds'> {
    const embedFields = [
        {
            name: "User",
            value: user.toString(),
            inline: true
        },
        {
            name: 'Command Name',
            value: `\`/${commandName}\``,
            inline: true
        },
        {
            name: 'Channel',
            value: channel.toString(),
            inline: true
        }
    ];
    if(optionData.length > 0) {
        embedFields.push({
            name: 'Options',
            value: optionData.map((option) => {
                switch(option.type) {
                    case 'STRING' || 'INTEGER' || 'NUMBER' || 'BOOLEAN':
                        return `\`${option.name}\`: ${option.value}`;
                    case 'CHANNEL':
                        return `\`${option.name}\`: <#${option.value}>`;
                    case 'USER' || 'ROLE' || 'MENTIONABLE':
                        return `\`${option.name}\`: <@${option.value}>`;
                    default:
                        return `\`${option.name}\`: ${option.value}`;
                }
            }).join('\n'),
            inline: false
        });
    }
    return {
        embeds: [{
            color: EmbedColor.Aqua,
            title: `Slash Command Used at <t:${new Date().getTime().toString().slice(0, -3)}:F>`,
            timestamp: new Date(),
            fields: embedFields
        }],
    };
}
