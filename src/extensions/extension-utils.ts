import { BaseMessageOptions } from 'discord.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { attendingServers } from '../global-states.js';
import { HelpQueueV2 } from '../help-queue/help-queue.js';
import { QueueDisplayV2 } from '../help-queue/queue-display.js';
import { ConstNoMethod } from '../utils/type-aliases.js';

type FrozenQueue = Omit<ConstNoMethod<HelpQueueV2>, 'timers'>;
type FrozenServer = ConstNoMethod<AttendingServerV2>;
type FrozenDisplay = Omit<
    QueueDisplayV2,
    'renderLoopTimerId' | 'requestQueueEmbedRender' | 'requestForceRender'
>;

async function sendLogs(
    serverId: string,
    conetent: BaseMessageOptions | string
): Promise<void> {
    await attendingServers.get(serverId)?.sendLogMessage(conetent);
}

export { sendLogs, FrozenServer, FrozenQueue, FrozenDisplay };
