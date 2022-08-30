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

export { Helpee, Helper};

