import { GuildMember } from "discord.js";

/**
 * Represents a student in the queue.
 * ----
 * - Created when a student uses /enqueue or the join button
 * - Removed when a students is dequeued
*/
type Helpee = {
    waitStart: Date;
    upNext: boolean;
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
    helpedMembers: GuildMember[]; // TODO: Change to Helpee
    readonly member: GuildMember; // backref
}

export { Helpee, Helper };

