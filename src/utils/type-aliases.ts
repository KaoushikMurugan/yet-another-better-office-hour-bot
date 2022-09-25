/**
 * These are just aliases to make keys of collections easier to read
 */

import { MessageOptions } from 'discord.js';

type GuildId = string;
type GuildMemberId = string;
type CategoryChannelId = string;
type RenderIndex = number;
type MessageId = string;

type HelpMessage = { 
    nameValuePair: [name: string, value: string], 
    useInHelpChannel: boolean,
    useInHelpCommand: boolean, // whether it's displayed by /help
    message: MessageOptions 
};

export {
    GuildId,
    GuildMemberId,
    CategoryChannelId,
    RenderIndex,
    MessageId,
    HelpMessage,
};