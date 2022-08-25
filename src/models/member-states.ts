import { GuildMember } from "discord.js";

type BeingHelped = {
    waitStart: Date;
    upNext: boolean;
    readonly member: GuildMember // backref
}

type Helping = {
    helpStart: Date;
    helpEnd: Date; // ? Maybe init to end of day
    helpedMembers: GuildMember[];
    readonly member: GuildMember; // backref
}

type Idle = "Idle"; // This is for everyone not in the queue, including tutors & admin

type MemberStateV2 = Helping | BeingHelped | Idle;

export { BeingHelped, Helping, Idle, MemberStateV2 };

