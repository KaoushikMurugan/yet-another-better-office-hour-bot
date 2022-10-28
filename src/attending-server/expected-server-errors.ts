/** @module ExpectedErrors */
import { ServerError } from '../utils/error-types.js';

const ExpectedServerErrors = {
    queueDoesNotExist: new ServerError('This queue does not exist.'),
    noOneToHelp: new ServerError(
        `There's no one left to help. You should get some coffee!`
    ),
    notHosting: new ServerError('You are not currently hosting.'),
    notInVC: new ServerError(`You need to be in a voice channel first.`),
    alreadyHosting: new ServerError('You are already hosting.'),
    noClassRole: new ServerError(
        `It seems like you don't have any class roles.\n` +
            `This might be a human error. ` +
            `In the meantime, you can help students by directly messaging them.`
    ),
    queueAlreadyExists: (name: string) => new ServerError(`Queue ${name} already exists`),
    apiFail: (err: Error) => new ServerError(`API Failure: ${err.name}\n${err.message}`),
    studentNotFound: (studentName: string) =>
        new ServerError(`The student ${studentName} is not in any of the queues.`),
    genericDequeueFailure: new ServerError('Dequeue with the given arguments failed.'),
    noAnnouncePerm: (queueName: string) =>
        new ServerError(
            `You don't have permission to announce in ${queueName}. ` +
                `You can only announce to queues that you have a role of.`
        ),
    noStudentToAnnounce: (announcement: string) =>
        new ServerError(
            'There are no students in the queue to send your announcement to. ' +
                "Here's your announcement if you would like to save it for later: " +
                `\`\`\`${announcement}\`\`\``
        )
} as const;

export { ExpectedServerErrors };
