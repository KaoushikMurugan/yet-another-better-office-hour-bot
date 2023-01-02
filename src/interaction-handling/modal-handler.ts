import { ModalSubmitInteraction } from 'discord.js';
import {
    AfterSessionMessageConfigMenu,
    QueueAutoClearConfigMenu
} from '../attending-server/server-settings-menus.js';
import { ModalSubmitHandlerProps } from './handler-interface.js';
import { ExpectedParseErrors } from './interaction-constants/expected-interaction-errors.js';
import { ModalNames } from './interaction-constants/interaction-names.js';
import { SuccessMessages } from './interaction-constants/success-messages.js';
import {
    isFromQueueChannelWithParent,
    isServerInteraction
} from './shared-validations.js';

const baseYabobModalMap: ModalSubmitHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [ModalNames.HelpTopicPromptModal]: interaction =>
                studentJoinedQueue(interaction),
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

async function studentJoinedQueue(
    interaction: ModalSubmitInteraction<'cached'>
): Promise<void> {
    const [server, queueChannel] = [
        isServerInteraction(interaction),
        isFromQueueChannelWithParent(interaction)
    ];
    const topic = interaction.fields.getTextInputValue('help_topic');
    const student = interaction.user;
    const channel = interaction.channel;
    if (channel === null) {
        throw ExpectedParseErrors.nonExistentTextChannel;
    }
    //await server.studentJoinedQueue(student, topic, channel);
    await interaction.reply({
        ...SuccessMessages.joinedQueue(queueChannel.queueName),
        ephemeral: true
    });
}

/**
 * Handles the modal submission from `/set_after_session_msg`
 * @param interaction
 * @returns
 */
async function setAfterSessionMessage(
    interaction: ModalSubmitInteraction<'cached'>,
    useMenu: boolean
): Promise<void> {
    const server = isServerInteraction(interaction);
    const message = interaction.fields.getTextInputValue('after_session_msg');
    await server.setAfterSessionMessage(message);
    await (useMenu && interaction.isFromMessage()
        ? interaction.update(
              AfterSessionMessageConfigMenu(server, interaction.channelId ?? '0', false)
          )
        : interaction.reply(SuccessMessages.updatedAfterSessionMessage(message)));
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
    const server = isServerInteraction(interaction);
    const hoursInput = interaction.fields.getTextInputValue('auto_clear_hours');
    const minutesInput = interaction.fields.getTextInputValue('auto_clear_minutes');
    const hours = hoursInput === '' ? 0 : parseInt(hoursInput);
    const minutes = minutesInput === '' ? 0 : parseInt(minutesInput);
    if (isNaN(hours) || isNaN(minutes)) {
        throw ExpectedParseErrors.badAutoClearValues;
    }
    const enable = !(hours === 0 && minutes === 0);
    await server.setQueueAutoClear(hours, minutes, enable);
    await (useMenu && interaction.isFromMessage()
        ? interaction.update(
              QueueAutoClearConfigMenu(server, interaction.channelId ?? '0', false)
          )
        : interaction.reply(
              enable
                  ? SuccessMessages.queueAutoClear.enabled(hours, minutes)
                  : SuccessMessages.queueAutoClear.disabled
          ));
}

export { baseYabobModalMap };
