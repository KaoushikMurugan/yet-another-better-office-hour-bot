/** @module MemberStates */

import { GuildMember } from 'discord.js';
import { HelpQueue } from '../help-queue/help-queue.js';

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
     * HelpQueueV2 object backref
     */
    queue: HelpQueue;
    /**
     * GuildMember object backref
     */
    readonly member: GuildMember;
    /**
     * The (optional) help topic the student entered when using `/enqueue` or [JOIN]
     */
    helpTopic?: string;
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
     * Whether the helper is accepting new students into the queue
     * - active: new students are accepted
     * - paused: allow helper to dequeue, but new students not accepted
     */
    activeState: 'active' | 'paused';
    /**
     * The members dequeued from `/next`
     */
    helpedMembers: Helpee[];
    /**
     * Backref
     */
    readonly member: GuildMember;
};

export type { Helpee, Helper };
