import { TextChannel } from 'discord.js';
import { CategoryChannelId } from '../utils/type-aliases.js';

/**
 * Wrapper for TextChannel
 * - Guarantees that a queueName and parentCategoryId exists
 */
type QueueChannel = Readonly<{
    /** The discord text channel named "queue" */
    textChannel: TextChannel;
    /** Name of the queue, matches the parent category name */
    queueName: string;
    /** Parent category channel id */
    parentCategoryId: CategoryChannelId;
}>;

export type { QueueChannel };
