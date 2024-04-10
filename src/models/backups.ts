/** @module  Backups */

import { z } from 'zod';
import { AutoClearTimeout } from '../help-queue/help-queue.js';
import { SimpleTimeZone } from '../utils/type-aliases.js';
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
    /** Queue name */
    name: string;
    /** The channel id of the category that this queue belongs to */
    parentCategoryId: string;
};

/** Represents the data of 1 AttendingServer */
type ServerBackup = {
    /** Discord server name */
    serverName: string;
    /** When the backup started */
    timeStamp: Date;
    /** List of queue backups */
    queues: QueueBackup[];
    /** After session message from `/set_after_session_msg` */
    afterSessionMessage: string;
    /**
     * Channel id of the text channel to send logs.
     * Empty if logging is disabled
     */
    loggingChannelId: string;
    /** Auto clear timeout from `/set_queue_auto_clear` */
    hoursUntilAutoClear: AutoClearTimeout;
    /** Seriousness of the server */
    seriousServer: boolean;
    /** The role id of the Bot Admin role */
    botAdminRoleId: string;
    /** The role id of the Staff role */
    staffRoleId: string;
    /** The role id of the Student role */
    studentRoleId: string;
    /** Whether to automatically give new members the student role */
    autoGiveStudentRole: boolean;
    /** whether to prompt modal asking for help topic when a user joins a queue */
    promptHelpTopic: boolean;
    /** Track data in Google sheet if true */
    trackingEnabled: boolean;
    /** timezone of this server */
    timezone: SimpleTimeZone;
};

const firebaseTimestampSchema = z.object({
    _nanoseconds: z.number(),
    _seconds: z.number()
});

const queueBackupSchema = z.object({
    studentsInQueue: z.array(
        z.object({
            waitStart: firebaseTimestampSchema,
            displayName: z.string(),
            memberId: z.string()
        })
    ),
    name: z.string(),
    parentCategoryId: z.string()
});

/**
 * Describes the data type of server backups stored in FIREBASE
 */
const serverBackupSchema = z.object({
    serverName: z.string(),
    timeStamp: firebaseTimestampSchema,
    afterSessionMessage: z.string(),
    loggingChannelId: z.string(),
    hoursUntilAutoClear: z.union([
        z.object({
            hours: z.number(),
            minutes: z.number()
        }),
        z.literal('AUTO_CLEAR_DISABLED')
    ]),
    queues: z.array(queueBackupSchema),
    seriousServer: z.boolean(),
    botAdminRoleId: z.string(),
    helperRoleId: z.optional(z.string()), // ! Migration code, remove in production
    staffRoleId: z.optional(z.string()), // ! Migration code, replace helperRoleId with this
    studentRoleId: z.string(),
    // ! Migration code, make this non-optional in 4.4
    autoGiveStudentRole: z.optional(z.boolean()),
    promptHelpTopic: z.optional(z.boolean()),
    trackingEnabled: z.optional(z.boolean()),
    timezone: z.optional(
        z.object({
            sign: z.union([z.literal('+'), z.literal('-')]),
            hours: z.number().min(0).max(12).int(),
            minutes: z.union([z.literal(0), z.literal(30), z.literal(45)])
        })
    )
});

export type { QueueBackup, ServerBackup };
export { queueBackupSchema, serverBackupSchema };
