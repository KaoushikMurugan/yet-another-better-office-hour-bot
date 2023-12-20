/** @module ExpectedErrors */
import { Snowflake } from 'discord.js';
import { ServerError } from '../utils/error-types.js';

/**
 * All the server level errors that we expect to happen
 * - **Some of the errors are functions and must be called before throwing**
 */
const ExpectedServerErrors = {
    notInitialized: new ServerError(
        'This server does not have a correctly initialized YABOB'
    ),
    queueDoesNotExist: new ServerError('This queue does not exist.'),
    noOneToHelp: new ServerError(
        `There's no one left to help. You should get some coffee!`
    ),
    notHosting: new ServerError('You are not currently hosting.'),
    notInVBC: new ServerError(`You need to be in a voice channel first.`),
    alreadyHosting: new ServerError('You are already hosting.'),
    noQueueRole: new ServerError(
        `It seems like you don't have any queue roles.\n` +
            `This might be a human error. ` +
            `In the meantime, you can help students by directly messaging them.`
    ),
    alreadyPaused: new ServerError(
        'You have already paused students from joining the queue. Did you mean to use `/resume`?'
    ),
    alreadyActive: new ServerError(
        'You are already an active helper. Did you mean to use `/pause`?'
    ),
    queueAlreadyExists: (name: string) => new ServerError(`Queue ${name} already exists`),
    categoryAlreadyExists: (name: string) =>
        new ServerError(`Category '${name}' already exists`),
    studentNotFound: (studentName: string) =>
        new ServerError(`The student ${studentName} is not in any of the queues.`),
    noAnnouncePerm: (queueName: string) =>
        new ServerError(
            `You don't have permission to announce in ${queueName}. You can only announce to queues that you have a role of.`
        ),
    noStudentToAnnounce: (announcement: string) =>
        new ServerError(
            'There are no students in the queue to send your announcement to.',
            "Here's your announcement if you would like to save it for later: " +
                `\`\`\`\n${announcement}\n\`\`\``
        ),
    badDequeueArguments: new ServerError( // this should not happen
        'Either student or the queue should be specified. Did you mean to use `/next` without options?'
    ),
    roleNotSet: (roleName: string) =>
        new ServerError(
            `The command can not be used without the role ${roleName} being set. ` +
                `Please ask a server moderator to use \`/role set ${roleName} <roleID>\` to set it.`
        ),
    studentBlockedDm: (studentThatClosedDm: Snowflake) =>
        new ServerError(
            'The student you just dequeued did not allow YABOB to send them an invite to your voice channel.' +
                " Don't worry, they have been successfully dequeued and your voice channel is now visible to them.",
            `ID of the unreachable student: <@${studentThatClosedDm}>.`
        ),
    memberNotFound: (userId: string) =>
        new ServerError(
            `No member with the userId ${userId} was found in this server`,
            `Please make sure you are using the correct userId.`
        )
} as const;

export { ExpectedServerErrors };
