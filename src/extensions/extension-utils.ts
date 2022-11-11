import { BaseMessageOptions } from 'discord.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { attendingServers } from '../global-states.js';
import { HelpQueueV2 } from '../help-queue/help-queue.js';
import { QueueDisplayV2 } from '../help-queue/queue-display.js';
import { red } from '../utils/command-line-colors.js';
import { ConstNoMethod } from '../utils/type-aliases.js';

type FrozenQueue = Omit<ConstNoMethod<HelpQueueV2>, 'timers'>;
type FrozenServer = ConstNoMethod<AttendingServerV2> & Pick<AttendingServerV2, 'getQueueChannels'>;
type FrozenDisplay = Omit<
    QueueDisplayV2,
    'renderLoopTimerId' | 'requestQueueEmbedRender' | 'requestForceRender'
>;

function sendLogs(serverId: string, content: BaseMessageOptions | string): void {
    const server = attendingServers.get(serverId);
    server?.sendLogMessage(content).catch(e => {
        console.error(red(`Failed to send logs to ${server.guild.name}.`));
        console.error(e);
    });
}

export { sendLogs, FrozenServer, FrozenQueue, FrozenDisplay };
