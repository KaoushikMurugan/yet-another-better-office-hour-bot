/** @module MemberStates */

import { GuildMember } from 'discord.js';
import { HelpQueueV2 } from '../help-queue/help-queue';

/**
 * Represents a student in the queue.
 * @remarks
 * - Created when a student uses `/enqueue` or `[JOIN]`
 * - Removed when a students is dequeued from `/next`
 */
type Helpee = {
    /**
     * When the student used `/enqueue` or [JOIN]
     */
    waitStart: Date;
    /**
     * Whether the student is up next or not
     * @deprecated currently unused, might be removed in future versions
     */
    upNext: boolean;
    /**
     * HelpQueueV2 object backref
     */
    queue: HelpQueueV2;
    /**
     * GuildMember object backref
     */
    readonly member: GuildMember;
};

/**
 * Represents a helper of a queue.
 * @remarks
 * - Created when a staff member uses `/start`
 * - Removed when a staff member uses `/close`
 */
type Helper = {
    /**
     * time when /start is used
     */
    helpStart: Date;
    /**
     * time when /stop is used
     */
    helpEnd?: Date;
    /**
     * The members dequeued from `/next`
     */
    helpedMembers: Helpee[];
    /**
     * Backref
     */
    readonly member: GuildMember;
};

export { Helpee, Helper };
