import { Helper } from '../../models/member-states.js';
import { SimpleEmbed, EmbedColor } from '../../utils/embed-helper.js';
import { convertMsToTime, padTo2Digits } from '../../utils/util-functions.js';

/**
 * All possible success messages of base yabob
 * - **Some messages are functions**, they need to be invoked before returning
 */
export const SuccessMessages = {
    createdQueue: (queueName: string) =>
        SimpleEmbed(
            `Successfully created \`${queueName}\`. It should be at the end of your channels list.`,
            EmbedColor.Success
        ),
    deletedQueue: (queueName: string) =>
        SimpleEmbed(`Successfully deleted \`${queueName}\`.`, EmbedColor.Success),
    joinedQueue: (queueName: string) =>
        SimpleEmbed(
            `Successfully joined the queue of \`${queueName}\`.`,
            EmbedColor.Success
        ),
    leftQueue: (queueName: string) =>
        SimpleEmbed(
            `Successfully left the queue of \`${queueName}\`.`,
            EmbedColor.Success
        ),
    joinedNotif: (queueName: string) =>
        SimpleEmbed(
            `Successfully joined the notification group of \`${queueName}\`.`,
            EmbedColor.Success
        ),
    removedNotif: (queueName: string) =>
        SimpleEmbed(
            `Successfully left the notification group of \`${queueName}\`.`,
            EmbedColor.Success
        ),
    inviteSent: (studentName: string) =>
        SimpleEmbed(`An invite has been sent to ${studentName}.`, EmbedColor.Success),
    startedHelping: SimpleEmbed(
        'You have started helping! Have fun!',
        EmbedColor.Success
    ),
    pausedHelping: (existOtherActiveHelpers: boolean) =>
        SimpleEmbed(
            `Successfully paused helping. ${
                existOtherActiveHelpers
                    ? 'Since there are other active helpers for at least one of the queues that you help for, some queues will still accept new students.'
                    : ''
            }`,
            EmbedColor.Success
        ),
    resumedHelping: SimpleEmbed('Successfully resumed helping.', EmbedColor.Success),
    finishedHelping: (helpTimeEntry: Required<Helper>) =>
        SimpleEmbed(
            `You helped for ` +
                convertMsToTime(
                    helpTimeEntry.helpEnd.getTime() - helpTimeEntry.helpStart.getTime()
                ) +
                `. See you later!`,
            EmbedColor.Success
        ),
    clearedQueue: (queueName: string) =>
        SimpleEmbed(`Everyone in  queue ${queueName} was removed.`, EmbedColor.Success),
    clearedAllQueues: (serverName: string) =>
        SimpleEmbed(`All queues on ${serverName} was cleared.`, EmbedColor.Success),
    announced: (announcement: string) =>
        SimpleEmbed(`Your announcement has been sent!`, EmbedColor.Success, announcement),
    updatedLoggingChannel: (loggingChannelName: string) =>
        SimpleEmbed(
            `Successfully updated logging channel to \`#${loggingChannelName}\`.`,
            EmbedColor.Success
        ),
    stoppedLogging: SimpleEmbed('Successfully stopped logging.', EmbedColor.Success),
    updatedAfterSessionMessage: (message: string) =>
        message.length === 0
            ? SimpleEmbed(
                  'Successfully disabled after session messages. YABOB will not send messages to students after they finish receiving help.',
                  EmbedColor.Success
              )
            : SimpleEmbed(
                  'The following message will be sent to the student after they finish receiving help:',
                  EmbedColor.Success,
                  message
              ),
    queueAutoClear: {
        enabled: (hours: number, minutes: number) =>
            SimpleEmbed(
                `Successfully enabled queue auto clear. ` +
                    `Queues will be automatically cleared in ` +
                    `${hours} hours and ${minutes} minutes after they are closed.`,
                EmbedColor.Success
            ),
        disabled: SimpleEmbed(
            `Successfully disabled queue auto clear.`,
            EmbedColor.Success
        )
    },
    cleanedUp: {
        queue: (queueName: string) =>
            SimpleEmbed(`Queue ${queueName} has been cleaned up.`, EmbedColor.Success),
        allQueues: SimpleEmbed('All queues have been cleaned up.', EmbedColor.Success),
        helpChannels: SimpleEmbed(
            "Successfully cleaned up everything under 'Bot Commands Help'.",
            EmbedColor.Success
        )
    },
    turnedOnSeriousMode: (warningMessage?: string) =>
        SimpleEmbed(
            `Serious mode has been turned on.`,
            EmbedColor.Success,
            '',
            warningMessage
        ),
    turnedOffSeriousMode: (warningMessage?: string) =>
        SimpleEmbed(
            `Serious mode has been turned off.\nThere's no need to be so serious!`,
            EmbedColor.Success,
            '',
            warningMessage
        ),
    createdOffices: (numOffices: number) =>
        SimpleEmbed(
            `Successfully created ${numOffices} office${
                numOffices === 1 ? '' : 's'
            }. It should be at the end of your channels list.`,
            EmbedColor.Success
        ),
    setBotAdminRole: (roleID: string) =>
        SimpleEmbed(
            `Successfully set the bot admin role to <@${roleID}>.`,
            EmbedColor.Success
        ),
    setHelperRole: (roleID: string) =>
        SimpleEmbed(
            `Successfully set the staff role to <@${roleID}>.`,
            EmbedColor.Success
        ),
    setStudentRole: (roleID: string) =>
        SimpleEmbed(
            `Successfully set the student role to <@${roleID}>.`,
            EmbedColor.Success
        ),
    turnedOnAutoGiveStudentRole: SimpleEmbed(
        `Successfully turned on auto give student role. The student role will be given to all new members who join the server`,
        EmbedColor.Success
    ),
    turnedOffAutoGiveStudentRole: SimpleEmbed(
        `Successfully turned off auto give student role. The student role will no longer be given to new members who join the server`,
        EmbedColor.Success
    ),
    turnedOnPromptHelpTopic: SimpleEmbed(
        `Successfully turned on prompt help topic. YABOB will prompt students to select a help topic when they join a queue.`,
        EmbedColor.Success
    ),
    turnedOffPromptHelpTopic: SimpleEmbed(
        `Successfully turned off prompt help topic. YABOB will no longer prompt students to select a help topic when they join a queue.`,
        EmbedColor.Success
    ),
    changedTimeZone: (sign: '+' | '-', hours: number, minutes: number) =>
        SimpleEmbed(
            `Successfully changed timezone of this server to **UTC ${sign}${padTo2Digits(
                hours
            )}:${padTo2Digits(minutes)}** `,
            EmbedColor.Success
        )
} as const;
