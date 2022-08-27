import { GuildMember } from "discord.js";

type Helpee = {
    waitStart: Date;
    upNext: boolean;
    readonly member: GuildMember // backref
}

type Helper = {
    helpStart: Date;
    helpEnd?: Date; // ? Maybe init to end of day
    helpedMembers: GuildMember[];
    readonly member: GuildMember; // backref
}

type Idle = "Idle"; // This is for everyone not in the queue, including tutors & admin

type MemberStateV2 = Helper | Helpee | Idle;

export { Helpee, Helper, Idle, MemberStateV2 };

