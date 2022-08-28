import { MessageOptions } from "discord.js";
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
    NeedName = 0x78dce8, // Aqua
}

export function SimpleEmbed(
    message: string,
    color = EmbedColor.Neutral,
    description?: string
): Pick<MessageOptions, "embeds"> {
    if (message.length <= 256) {
        return {
            embeds: [{
                color: color,
                title: message,
                timestamp: new Date(),
                description: description,
                author: {
                    name: 'BOBv3',
                    iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
                },
            }],
        };
    } else {
        // TODO: if longer than 256? characters 
        // TODO: break up into more than one message/embed
        return {
            embeds: [{
                color: color,
                description: message,
                timestamp: new Date(),
                // TODO: author: { name: 'BOBv3', iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png' },
            }],
        };
    }
}


export function ErrorEmbed(
    err: UserViewableError,
): Pick<MessageOptions, "embeds"> {
    let color = EmbedColor.KindaBad;
    const embedFields = [
        {
            name: 'Error Type',
            value: err.name,
            inline: true
        }
    ];
    if (err instanceof QueueError) {
        color = EmbedColor.NeedName;
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
                + `and ping @Officers.`,
            author: {
                name: 'BOBv3',
                iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png'
            },
            fields: embedFields
        }],
    };
}