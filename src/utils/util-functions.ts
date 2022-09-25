import { GuildMember, GuildMemberRoleManager, Role } from 'discord.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server';

/**
 * Converts the time delta in miliseconds into a readable format
 * ----
 * @param milliseconds the difference to convert
*/
function convertMsToTime(milliseconds: number): string {
    function padTo2Digits(num: number): string {
        return num.toString().padStart(2, '0');
    }
    let seconds = Math.floor(milliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    return `${hours > 0 ? `${padTo2Digits(hours)} hour${hours === 1 ? '' : 's'}, ` : ``}` +
        `${minutes > 0 ? `${padTo2Digits(minutes)} minute${minutes === 1 ? '' : 's'}, ` : ``}` +
        `${padTo2Digits(seconds)} second${seconds === 1 ? '' : 's'}`;
}

/**
 * Gets all the queue roles of a member
 * ----
 * @param server 
 * @param member 
 * @returns list of queue roles
 */
async function getQueueRoles(
    server: AttendingServerV2,
    member: GuildMember
): Promise<Role[]> {
    const memberRoles = member.roles as GuildMemberRoleManager;
    const queueChannels = await server.getQueueChannels();
    return [...memberRoles.cache.filter(role => queueChannels
        .some(queue => queue.queueName === role.name)).values()];
}

export { convertMsToTime, getQueueRoles };
