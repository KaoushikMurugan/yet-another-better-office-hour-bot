export class EmbedColor {
    static Success = 0x00FF00       // Green
    static Error = 0xFF0000         // Red
    static Neutral = 0xFBA736       // Orange
    static Warning = 0xFFFF00       // Yellow
    static NeedName = 0x0000FF      // Blue
}

export function SimpleEmbed(message: string, color = EmbedColor.Neutral): any {
    if (message.length > 256) {
        return {
            embeds: [{
                color: color,
                title: message,
                timestamp: new Date(),
                // TODO: author: { name: 'BOBv3', iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png' },
            }]
        }
    } else {
        // For future: if longer than 4096 characters break up into more than one message/embed
        return {
            embeds: [{
                color: color,
                description: message,
                timestamp: new Date(),
                // TODO author: { name: 'BOBv3', iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png' },
            }]
        }
    }
}