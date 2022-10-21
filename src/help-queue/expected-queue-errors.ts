/** @module ExpectedErrors */

import { QueueError } from '../utils/error-types';

const ExpectedQueueErrors = {
    alreadyOpen: (queueName: string) =>
        new QueueError('Queue is already open', queueName),
    alreadyClosed: (queueName: string) =>
        new QueueError('Queue is already closed', queueName),
    notOpen: (queueName: string) => new QueueError(`Queue is not open.`, queueName),
    notActiveHelper: (queueName: string) =>
        new QueueError('You are not one of the helpers', queueName),
    alreadyInQueue: (queueName: string) =>
        new QueueError('You are already in the queue.', queueName),
    enqueueHelper: (queueName: string) =>
        new QueueError("You can't enqueue yourself while helping.", queueName),
    dequeue: {
        closed: (queueName: string) =>
            new QueueError(
                'This queue is not open. Did you mean to use `/start`?',
                queueName
            ),
        empty: (queueName: string) =>
            new QueueError("There's no one in the queue", queueName),
        noPermission: (queueName: string) =>
            new QueueError("You don't have permission to help this queue", queueName)
    },
    studentNotInQueue: (studentName: string, queueName: string) =>
        new QueueError(
            `The specified student ${studentName} ` + `is not in the queue`,
            queueName
        ),
    alreadyInNotifGroup: (queueName: string) =>
        new QueueError('You are already in the notification squad.', queueName),
    notInNotifGroup: (queueName: string) =>
        new QueueError('You are not in the notification squad.', queueName)
} as const;

export { ExpectedQueueErrors };
