import { MessageOptions } from "discord.js";

export enum EmbedColor {
    Success = 0x00ff00, // Green
    Error = 0xff0000, // Red
    Neutral = 0xfba736, // Orange
    Warning = 0xffff00, // Yellow
    NeedName = 0x0000ff, // Blue
}

export function SimpleEmbed(
    message: string,
    color = EmbedColor.Neutral
): Pick<MessageOptions, "embeds"> {
    if (message.length <= 256) {
        return {
            embeds: [
                {
                    color: color,
                    title: message,
                    timestamp: new Date(),
                    // TODO: author: { name: 'BOBv3', iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png' },
                },
            ],
        };
    } else {
        // TODO: if longer than 4096 characters break up into more than one message/embed
        return {
            embeds: [
                {
                    color: color,
                    description: message,
                    timestamp: new Date(),
                    // TODO: author: { name: 'BOBv3', iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png' },
                },
            ],
        };
    }
}
