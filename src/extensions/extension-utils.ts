import { BaseMessageOptions } from 'discord.js';
import { attendingServers } from '../global-states.js';

async function sendLogs(
    serverId: string,
    conetent: BaseMessageOptions | string
): Promise<void> {
    await attendingServers.get(serverId)?.sendLogMessage(conetent);
}

export { sendLogs };
