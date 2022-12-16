import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { HelpQueueV2 } from '../help-queue/help-queue.js';
import { QueueDisplayV2 } from '../help-queue/queue-display.js';
import { ConstNoMethod } from '../utils/type-aliases.js';

/**
 * Removes all public methods from HelpQueueV2 and marks everything readonly
 */
type FrozenQueue = Omit<ConstNoMethod<HelpQueueV2>, 'timers'>;

/**
 * Removes all public methods from AttendingServerV2 and marks everything readonly
 *  except the methods that doesn't affect the AttendingServerV2's internal state
 * - getQueueChannels
 * - sendLogMessage
 */
type FrozenServer = ConstNoMethod<AttendingServerV2> &
    Pick<AttendingServerV2, 'getQueueChannels' | 'sendLogMessage'>;

/**
 * Only exposes the requestNonQueueEmbedRender method for extensions
 */
type FrozenDisplay = Pick<QueueDisplayV2, 'requestNonQueueEmbedRender'>;

export { FrozenServer, FrozenQueue, FrozenDisplay };
