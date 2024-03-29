/** @module ExpectedErrors */

import { Snowflake } from 'discord.js';
import { QueueError } from '../utils/error-types.js';

/**
 * All the queue level errors that we expect to happen
 * - **Some of the errors are functions and must be called before throwing**
 */
const ExpectedQueueErrors = {
    alreadyOpen: (queueName: string) =>
        new QueueError('Queue is already open.', queueName),
    alreadyClosed: (queueName: string) =>
        new QueueError('Queue is already closed.', queueName),
    enqueueNotAllowed: (queueName: string) =>
        new QueueError(
            `You cannot join this queue because it's either closed or paused.`,
            queueName
        ),
    notActiveHelper: (queueName: string) =>
        new QueueError(`You are not one of the helpers for ${queueName}`, queueName),
    alreadyPaused: (queueName: string) =>
        new QueueError(`You have already paused helping.`, queueName),
    alreadyActive: (queueName: string) =>
        new QueueError(`You are already an active helper for ${queueName}`, queueName),
    alreadyInQueue: (queueName: string) =>
        new QueueError('You are already in the queue.', queueName),
    cannotEnqueueHelper: (queueName: string) =>
        new QueueError("You can't enqueue yourself while helping.", queueName),
    dequeue: {
        closed: (queueName: string) =>
            new QueueError(
                `This queue is not open. Do you have the \`${queueName}\` role?`,
                queueName
            ),
        empty: (queueName: string) =>
            new QueueError("There's no one in the queue.", queueName),
        noPermission: (queueName: string) =>
            new QueueError("You don't have permission to help this queue.", queueName)
    },
    studentNotInQueue: (studentName: string, queueName: string) =>
        new QueueError(`${studentName} is not in the queue.`, queueName),
    alreadyInNotifGroup: (queueName: string) =>
        new QueueError(
            `You are already in the notification group for ${queueName}.`,
            queueName
        ),
    notInNotifGroup: (queueName: string) =>
        new QueueError(
            `You are not in the notification group for ${queueName}.`,
            queueName
        ),
    staffBlockedDm: (
        queueName: string,
        studentActionText: string,
        helpersThatClosedDm: Snowflake[]
    ) =>
        new QueueError(
            `One or more staff members did not allow YABOB to notify them that you ${studentActionText}. Don't worry, you have been successfully added to the queue.`,
            queueName,
            `ID of unreachable helpers: ${helpersThatClosedDm
                .map(id => `<@${id}>`)
                .join(' ')}.`
        )
} as const;

export { ExpectedQueueErrors };
