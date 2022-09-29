/**
 * These are just aliases to make keys of collections easier to read
 */

import { APIApplicationCommandOptionChoice, BaseMessageOptions } from 'discord.js';

type GuildId = string;
type GuildMemberId = string;
type CategoryChannelId = string;
type RenderIndex = number;
type MessageId = string;

type HelpMessage = { 
    nameValuePair: APIApplicationCommandOptionChoice<string>, 
    useInHelpChannel: boolean,
    useInHelpCommand: boolean, // whether it's displayed by /help
    message: BaseMessageOptions 
};

export {
    GuildId,
    GuildMemberId,
    CategoryChannelId,
    RenderIndex,
    MessageId,
    HelpMessage,
};