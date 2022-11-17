import { Guild } from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../utils/embed-helper.js';
import { client } from '../global-states.js';

async function initializationCheck(guild: Guild): Promise<void> {
    if (guild.members.me === null || !guild.members.me.permissions.has('Administrator')) {
        const owner = await guild.fetchOwner();
        await owner.send(
            SimpleEmbed(
                `Sorry, I need full administrator permission for '${guild.name}'`,
                EmbedColor.Error
            )
        );
        await guild.leave();
        throw Error("YABOB doesn't have admin permission.");
    }
    if (guild.members.me.roles.highest.comparePositionTo(guild.roles.highest) < 0) {
        const owner = await guild.fetchOwner();
        await owner.send(
            SimpleEmbed(
                `It seems like I'm joining a server with existing roles. ` +
                    `Please go to server settings -> Roles and change ${client.user.username} ` +
                    `to the highest role.\n`,
                EmbedColor.Error
            )
        );
        throw Error("YABOB doesn't have highest role.");
    }
}

export { initializationCheck };
