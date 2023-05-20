import { ModalSubmitInteraction } from 'discord.js';
import {
    AfterSessionMessageConfigMenu,
    QueueAutoClearConfigMenu
} from '../attending-server/server-settings-menus.js';
import { ModalSubmitHandlerProps } from './handler-interface.js';
import { ExpectedParseErrors } from './interaction-constants/expected-interaction-errors.js';
import { ModalNames } from './interaction-constants/interaction-names.js';
import { SuccessMessages } from './interaction-constants/success-messages.js';
import { isFromQueueChannelWithParent } from './shared-validations.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';

const baseYabobModalMap: ModalSubmitHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [ModalNames.PromptHelpTopicModal]: submitHelpTopic,
            [ModalNames.AfterSessionMessageModal]: interaction =>
                setAfterSessionMessage(interaction, false),
            [ModalNames.AfterSessionMessageModalMenuVersion]: interaction =>
                setAfterSessionMessage(interaction, true),
            [ModalNames.QueueAutoClearModal]: interaction =>
                setQueueAutoClear(interaction, false),
            [ModalNames.QueueAutoClearModalMenuVersion]: interaction =>
                setQueueAutoClear(interaction, true)
        }
    },
    dmMethodMap: {}
};

/**
 * Handles help topic modal submit. This modal is shown when student enqueues
 * @param interaction
 */
async function submitHelpTopic(
    interaction: ModalSubmitInteraction<'cached'>
): Promise<void> {
    const [server, queueChannel] = [
        AttendingServerV2.get(interaction.guildId),
        isFromQueueChannelWithParent(interaction)
    ];
    const topic = interaction.fields.getTextInputValue('help_topic');
    const student = interaction.member;
    const helpQueue = server.getQueueById(queueChannel.parentCategoryId);

    await helpQueue.notifyHelpersOn('submitHelpTopic', student, topic);
    await helpQueue.updateStudentHelpTopic(student, topic);
    await interaction.reply({
        ...SuccessMessages.joinedQueue(queueChannel.queueName),
        ephemeral: true
    });
}

/**
 * Handles the modal submission from `/set_after_session_msg`
 * @param interaction
 */
async function setAfterSessionMessage(
    interaction: ModalSubmitInteraction<'cached'>,
    useMenu: boolean
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const message = interaction.fields.getTextInputValue('after_session_msg');
    if (message.length >= 4096) {
        throw ExpectedParseErrors.messageIsTooLong;
    }
    await server.setAfterSessionMessage(message);
    await (useMenu && interaction.isFromMessage()
        ? interaction.update(
              AfterSessionMessageConfigMenu(
                  server,
                  interaction.channelId,
                  false,
                  message.length === 0
                      ? 'Successfully disabled after session message.'
                      : 'After session message has been updated!'
              )
          )
        : interaction.reply({
              ...SuccessMessages.updatedAfterSessionMessage(message),
              ephemeral: true
          }));
}

/**
 * Handles the modal submission from `/set_queue_auto_clear`
 * @param interaction
 * @returns
 */
async function setQueueAutoClear(
    interaction: ModalSubmitInteraction<'cached'>,
    useMenu: boolean
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const hoursInput = interaction.fields.getTextInputValue('auto_clear_hours');
    const minutesInput = interaction.fields.getTextInputValue('auto_clear_minutes');
    let hours = hoursInput === '' ? 0 : parseInt(hoursInput, 10); // only accept base 10 inputs
    let minutes = minutesInput === '' ? 0 : parseInt(minutesInput, 10);
    if (isNaN(hours) || isNaN(minutes)) {
        throw ExpectedParseErrors.badAutoClearValues;
    }
    // move the excess minutes into hours
    // if hours > 99, it can't be displayed in a modal with only 2 characters
    hours = Math.min(99, hours + Math.floor(minutes / 60));
    minutes %= 60;
    const enable = !(hours === 0 && minutes === 0);
    await server.setQueueAutoClear(hours, minutes, enable);
    await (useMenu && interaction.isFromMessage()
        ? interaction.update(
              QueueAutoClearConfigMenu(
                  server,
                  interaction.channelId,
                  false,
                  enable
                      ? 'Queue auto clear configuration has been updated!'
                      : 'Successfully disabled queue auto clear.'
              )
          )
        : interaction.reply({
              ...(enable
                  ? SuccessMessages.queueAutoClear.enabled(hours, minutes)
                  : SuccessMessages.queueAutoClear.disabled),
              ephemeral: true
          }));
}

export { baseYabobModalMap };
