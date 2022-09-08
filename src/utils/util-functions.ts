import { GuildMember, GuildMemberRoleManager, Role } from "discord.js";
import { AttendingServerV2 } from "../attending-server/base-attending-server";

/**
 * Converts the time delta in miliseconds into a readable format
 * ----
 * @param timeDiffInMs the difference to convert
*/
function msToHourMins(timeDiffInMs: number): string {
    const totalSeconds = Math.round(Math.abs(timeDiffInMs) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    return (hours > 0
        ? `${hours} hours and ${((totalSeconds - hours * 3600) / 60).toFixed(2)} minutes`
        : `${(totalSeconds / 60).toFixed(2)} minutes`);
}

async function getQueueRoles(
    server: AttendingServerV2,
    member: GuildMember
): Promise<Role[]> {
    const memberRoles = member.roles as GuildMemberRoleManager;
    const queueChannels = await server.getQueueChannels();
    return [...memberRoles.cache.filter(role => queueChannels
        .some(queue => queue.queueName === role.name)).values()];
}


export { msToHourMins, getQueueRoles };
