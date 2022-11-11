import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { HelpQueueV2 } from '../help-queue/help-queue.js';
import { QueueDisplayV2 } from '../help-queue/queue-display.js';
import { ConstNoMethod } from '../utils/type-aliases.js';

type FrozenQueue = Omit<ConstNoMethod<HelpQueueV2>, 'timers'>;
type FrozenServer = ConstNoMethod<AttendingServerV2> &
    Pick<AttendingServerV2, 'getQueueChannels' | 'sendLogMessage'>;
type FrozenDisplay = Omit<
    QueueDisplayV2,
    'renderLoopTimerId' | 'requestQueueEmbedRender' | 'requestForceRender'
>;

export { FrozenServer, FrozenQueue, FrozenDisplay };
