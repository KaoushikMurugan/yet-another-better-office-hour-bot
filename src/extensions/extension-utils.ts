import type { AttendingServer } from '../attending-server/base-attending-server.js';
import type { HelpQueue } from '../help-queue/help-queue.js';
import type { QueueDisplay } from '../help-queue/queue-display.js';
import type { ConstNoMethod } from '../utils/type-aliases.js';

/**
 * Removes all public methods from HelpQueueV2 and marks everything readonly
 */
type FrozenQueue = Omit<ConstNoMethod<HelpQueue>, 'timers'>;

/**
 * Removes all public methods from AttendingServerV2 and marks everything readonly
 *  except the methods that doesn't affect the AttendingServerV2's internal state
 * - getQueueChannels
 * - sendLogMessage
 */
type FrozenServer = ConstNoMethod<AttendingServer> &
    Pick<AttendingServer, 'getQueueChannels' | 'sendLogMessage'>;

/**
 * Only exposes the requestExtensionEmbedRender method for extensions
 */
type FrozenDisplay = Pick<QueueDisplay, 'requestExtensionEmbedRender'>;


// test changes
export type { FrozenServer, FrozenQueue, FrozenDisplay };
