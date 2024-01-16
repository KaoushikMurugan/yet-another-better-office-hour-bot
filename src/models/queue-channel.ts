import { TextChannel } from 'discord.js';
import { CategoryChannelId } from '../utils/type-aliases.js';

/**
 * Wrapper for TextChannel
 * - Guarantees that a queueName and parentCategoryId exists
 */
type QueueChannel = Readonly<{
    textChannel: TextChannel;
    queueName: string;
    parentCategoryId: CategoryChannelId;
}>;

export { QueueChannel };
