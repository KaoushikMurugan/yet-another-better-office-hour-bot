import { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import { QueueChannel } from '../attending-server/base-attending-server.js';
import { ExpectedParseErrors } from '../command-handling/expected-interaction-errors.js';
import { isTextChannel } from '../utils/util-functions.js';

function isFromQueueChannelWithParent(
    interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>
): QueueChannel {
    if (!isTextChannel(interaction.channel) || interaction.channel.parent === null) {
        throw ExpectedParseErrors.queueHasNoParent;
    }
    const queueChannel: QueueChannel = {
        channelObj: interaction.channel,
        queueName: interaction.channel.parent.name,
        parentCategoryId: interaction.channel.parent.id
    };
    return queueChannel;
}

export { isFromQueueChannelWithParent };
