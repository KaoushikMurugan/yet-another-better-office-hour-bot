/** @module  Backups */

import { AutoClearTimeout } from '../help-queue/help-queue.js';
import { Helpee } from './member-states.js';

/** Represent the data of 1 HelpQueue */
type QueueBackup = {
    /**
     * Students in the queue. A list of Helpee objects without the back references
     */
    studentsInQueue: ReadonlyArray<
        Omit<Helpee, 'member' | 'queue'> & {
            displayName: string;
            memberId: string;
        }
    >;
    /**
     * Queue name
     */
    name: string;
    /**
     * The channel id of the category that this queue belongs to
     */
    parentCategoryId: string;
};

/** Represent the data of 1 AttendingServer */
type ServerBackup = {
    /**
     * Discord server name
     */
    serverName: string;
    /**
     * When the backup started
     */
    timeStamp: Date;
    /**
     * List of queue backups
     */
    queues: QueueBackup[];
    /**
     * After session message from `/set_after_session_msg`
     */
    afterSessionMessage: string;
    /**
     * Channel id of the text channel to send logs. Empty if logging is disabled
     */
    loggingChannelId: string;
    /**
     * Auto clear timeout from `/set_queue_auto_clear`
     */
    hoursUntilAutoClear: AutoClearTimeout;
    /**
     * Seriousness of the server
     */
    seriousServer: boolean;

    /**
     * The role id of the Bot Admin role
     */
    botAdminRoleId: string;

    /**
     * The role id of the Helper role
     */
    helperRoleId: string;

    /**
     * The role id of the Student role
     */
    studentRoleId: string;
};

export { QueueBackup, ServerBackup };
