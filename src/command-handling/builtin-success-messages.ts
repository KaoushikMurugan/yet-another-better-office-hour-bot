import { Helper } from '../models/member-states';
import { convertMsToTime } from '../utils/util-functions';

export const SuccessMessages = {
    createdQueue: (queueName:string) => `Successfully created \`${queueName}\`.`,
    deletedQueue: (queueName:string) => `Successfully deleted \`${queueName}\`.`,
    joinedQueue: (queueName: string) =>
        `Successfully joined the queue of \`${queueName}\`.`,
    leftQueue: (queueName: string) => `Successfully left the queue of \`${queueName}\`.`,
    joinedNotif: (queueName: string) =>
        `Successfully joined the notification group of \`${queueName}\`.`,
    removedNotif: (queueName: string) =>
        `Successfully left the notification group of \`${queueName}\`.`,
    inviteSent: (studentName = 'unkown student') =>
        `An invite has been sent to ${studentName}.`,
    startedHelping: 'You have started helping! Have fun!',
    finishedHelping: (helpTimeEntry: Required<Helper>) =>
        `You helped for ` +
        convertMsToTime(
            helpTimeEntry.helpEnd.getTime() - helpTimeEntry.helpStart.getTime()
        ) +
        `. See you later!`,
    clearedQueue: (queueName: string) => `Everyone in  queue ${queueName} was removed.`,
    clearedAllQueues: (serverName = 'unknown server') =>
        `All queues on ${serverName} was cleard.`,
    announced: (announcement: string) =>
        `Your announcement: ${announcement} has been sent!`,
    cleanedUpQueue: (queueName: string) => `Queue ${queueName} has been cleaned up.`,
    allQueuesCleanedUp: `All queues have been cleaned up.`,
    cleanedUpHelpChannel: `Successfully cleaned up everything under 'Bot Commands Help'.`,
    updatedLoggingChannel: (loggingChannelName: string) =>
        `Successfully updated logging channel to \`#${loggingChannelName}\`.`,
    stoppedLogging: 'Successfully stopped logging.',
    updatedAfterSessionMessage: (message: string) =>
        `After session message set to:\n${message}.`,
    queueAutoClear: {
        enabled: (hours: number, minutes: number) =>
            `Successfully enabled queue auto clear. ` +
            `Queues will be automatically cleared in ` +
            `${hours} hours and ${minutes} minutes after they are closed.`,
        disabled: `Successfully disabled queue auto clear.`
    }
} as const;
