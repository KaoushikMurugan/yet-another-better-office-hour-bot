import { GuildMember } from "discord.js";
import { HelpQueueV2 } from "../help-queue/help-queue";

/**
 * Represents a student in the queue.
 * ----
 * - Created when a student uses /enqueue or the join button
 * - Removed when a students is dequeued
*/
type Helpee = {
    waitStart: Date;
    upNext: boolean;
    queue: HelpQueueV2;
    readonly member: GuildMember // backref
}

/**
 * Represents a helper of a queue.
 * ----
 * - Created when a staff member uses /start
 * - Removed when a staff member uses /close
*/
type Helper = {
    helpStart: Date; // time when /start is used
    helpEnd?: Date; // time when /stop is used
    helpedMembers: Helpee[]; // TODO: Change to Helpee
    readonly member: GuildMember; // backref
}

export { Helpee, Helper };

