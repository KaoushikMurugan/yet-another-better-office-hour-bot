import { AttendingServerV2 } from '../attending-server/base-attending-server';
import { HelpQueueV2 } from '../help-queue/help-queue';


/**
 * Any class that implements this interface should visit server/queues to collect their stats
 * ----
 * @see [Visitor Pattern](https://refactoring.guru/design-patterns/visitor)
 * @usage 
 * - create an instance on server/queue creation and make it readonly
 * - then call collect when a collection is necessary; 
 *     - this updates the internal state of the collector
 * - call export in appropriate events
*/
interface StatisticsCollector {
    collectServerStats: (server: AttendingServerV2) => void;
    collectQueueStats: (queue: HelpQueueV2) => void;
}


class ServerStatsCollector implements StatisticsCollector {

    /**
     * maintain a snapshot of the server here
     * 
    */


    collectServerStats(server: AttendingServerV2) {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    collectQueueStats(_: HelpQueueV2) {
        // should not be used, only here to make the interface concrete
        return;
    }

}

class QueueStatsCollector implements StatisticsCollector {


    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    collectServerStats(_: AttendingServerV2) {
        // should not be used, only here to make the interface concrete
        return;
    }


    collectQueueStats(queue: HelpQueueV2) {
        return;
    }
}


export { StatisticsCollector };