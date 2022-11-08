/** @module Utilities */

import {
    ButtonInteraction,
    CategoryChannel,
    ChannelType,
    ChatInputCommandInteraction,
    GuildMember,
    Interaction,
    ModalSubmitInteraction,
    GuildBasedChannel,
    Role,
    TextChannel,
    VoiceChannel
} from 'discord.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { cyan, yellow, magenta } from './command-line-colors.js';
import { YabobButton } from './type-aliases.js';
import { convertBase } from 'simple-base-converter';
/**
 * Converts the time delta in miliseconds into a readable format
 * @param milliseconds the difference to convert
 */
function convertMsToTime(milliseconds: number): string {
    function padTo2Digits(num: number): string {
        return num.toString().padStart(2, '0');
    }

    let seconds = Math.floor(milliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    return (
        `${hours > 0 ? `${padTo2Digits(hours)} hour${hours === 1 ? '' : 's'}, ` : ``}` +
        `${
            minutes > 0
                ? `${padTo2Digits(minutes)} minute${minutes === 1 ? '' : 's'}, `
                : ``
        }` +
        `${padTo2Digits(seconds)} second${seconds === 1 ? '' : 's'}`
    );
}
/**
 * Converts the time delta in miliseconds into a readable format
 * @param milliseconds the difference to convert
 */
function convertMsToShortTime(milliseconds: number): string {
    function padTo2Digits(num: number): string {
        return num.toString().padStart(2, '0');
    }

    let seconds = Math.floor(milliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
}
/**
 * Gets all the queue roles of a member
 * @param server
 * @param member
 * @returns list of queue roles
 */
async function getQueueRoles(
    server: AttendingServerV2,
    member: GuildMember
): Promise<Role[]> {
    const queueChannels = await server.getQueueChannels();
    return [
        ...member.roles.cache
            .filter(role => queueChannels.some(queue => queue.queueName === role.name))
            .values()
    ];
}

/**
 * Default logger for button presses
 * @param interaction
 * @param buttonName
 * @param queueName
 */
function logButtonPress(
    interaction: ButtonInteraction<'cached'>,
    buttonName: string,
    queueName: string
): void {
    console.log(
        `[${cyan(
            new Date().toLocaleString('en-US', {
                timeZone: 'PST8PDT'
            })
        )} ` +
            `${yellow(interaction.guild.name)}]\n` +
            ` - User: ${interaction.user.username} (${interaction.user.id})\n` +
            ` - Server Id: ${interaction.guildId}\n` +
            ` - Button Pressed: ${magenta(buttonName)}\n` +
            ` - In Queue: ${queueName}`
    );
}

/**
 * Default logger for modal submits
 * @param interaction
 */
function logModalSubmit(interaction: ModalSubmitInteraction<'cached'>): void {
    console.log(
        `[${cyan(
            new Date().toLocaleString('en-US', {
                timeZone: 'PST8PDT'
            })
        )} ` +
            `${yellow(interaction.guild.name)}]\n` +
            ` - User: ${interaction.user.username} (${interaction.user.id})\n` +
            ` - Server Id: ${interaction.guildId}\n` +
            ` - Modal Used: ${magenta(interaction.customId)}`
    );
}

/**
 * Default logger for slash commands
 * @param interaction
 */
function logSlashCommand(interaction: ChatInputCommandInteraction<'cached'>): void {
    console.log(
        `[${cyan(
            new Date().toLocaleString('en-US', {
                timeZone: 'PST8PDT'
            })
        )} ` +
            `${yellow(interaction.guild.name)}]\n` +
            ` - User: ${interaction.user.username} (${interaction.user.id})\n` +
            ` - Server Id: ${interaction.guildId}\n` +
            ` - Command Used: ${magenta(interaction.toString())}`
    );
}

function addTimeOffset(date: Date, hours: number, minutes: number): Date {
    // might have problems with daylight saving
    return new Date(date.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000);
}

function getInteractionName(interaction: Interaction<'cached'>): string {
    if (interaction.isCommand()) {
        return interaction.commandName;
    }
    if (interaction.isButton()) {
        return interaction.component.label ?? interaction.customId;
    }
    if (interaction.isModalSubmit()) {
        return interaction.customId;
    }
    return 'Unsupported Interaction Type';
}

/**
 * Narrows the type down to category channel
 * @param channel any channel from a server
 * @returns type narrower
 */
function isCategoryChannel(
    channel: GuildBasedChannel | null | undefined
): channel is CategoryChannel {
    // shorthand syntax, coerces the type into a boolean
    return !!channel && 'type' in channel && channel.type === ChannelType.GuildCategory;
}

/**
 * Narrows the type down to text channel
 * @param channel any channel from a server
 * @returns type narrower
 */
function isTextChannel(
    channel: GuildBasedChannel | null | undefined
): channel is TextChannel {
    return !!channel && channel.type === ChannelType.GuildText;
}

/**
 * Narrows the type down to text channel and checks if the name is `queue`
 * @param channel any channel from a server
 * @returns type narrower
 */
function isQueueTextChannel(
    channel: GuildBasedChannel | null | undefined
): channel is TextChannel {
    return (
        !!channel && channel.type === ChannelType.GuildText && channel.name === 'queue'
    );
}

function isVoiceChannel(
    channel: GuildBasedChannel | null | undefined
): channel is VoiceChannel {
    return !!channel && channel.type === ChannelType.GuildVoice;
}

function centered(text: string): string {
    return (
        `${' '.repeat((process.stdout.columns - text.length) / 2)}` +
        `${text}` +
        `${' '.repeat((process.stdout.columns - text.length) / 2)}`
    );
}

function isValidChannelName(channelName: string): boolean {
    const invalidCharacters = /[ `!@#$%^&*()+=[\]{};':"\\|,.<>/?~]/;
    return (
        channelName.length <= 100 &&
        channelName.length > 0 &&
        !invalidCharacters.test(channelName)
    );
}

function isValidCategoryName(categoryName: string): boolean {
    return (
        categoryName.length <= 100 &&
        categoryName.length > 0 &&
        categoryName.trim().length > 0
    );
}

function convertSnowflakeToBase64(snowflake: string): string {
    return convertBase(
        snowflake,
        '0123456789',
        '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-+!@#$^'
    );
}

function convertBase64ToSnowflake(base64: string): string {
    return convertBase(
        base64,
        '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-+!@#$^',
        '0123456789'
    );
}

function generateDMYabobButtonId(
    buttonName: string,
    serverId: string,
    channelId: string
): YabobButton<'dm'> {
    return {
        n: buttonName,
        t: 'dm',
        s: serverId,
        c: channelId,
        q: undefined
    };
}

function generateQueueYabobButtonId(
    buttonName: string,
    serverId: string,
    channelId: string,
    queueName: string
): YabobButton<'queue'> {
    return {
        n: buttonName,
        t: 'queue',
        s: serverId,
        c: channelId,
        q: queueName
    };
}

function generateOtherYabobButtonId(
    buttonName: string,
    serverId: string,
    channelId: string
): YabobButton<'other'> {
    return {
        n: buttonName,
        t: 'other',
        s: serverId,
        c: channelId,
        q: undefined
    };
}

function yabobButtonToString(yabobButton: YabobButton<'dm' | 'other' | 'queue'>): string {
    yabobButton.s = convertSnowflakeToBase64(yabobButton.s);
    yabobButton.c = convertSnowflakeToBase64(yabobButton.c);
    return JSON.stringify(yabobButton);
}

function parseYabobButtonId(
    customButtonId: string
): YabobButton<'dm' | 'other' | 'queue'> {
    const yabobButtonId = JSON.parse(customButtonId) as YabobButton<
        'dm' | 'other' | 'queue'
    >;
    yabobButtonId.s = convertBase64ToSnowflake(yabobButtonId.s);
    yabobButtonId.c = convertBase64ToSnowflake(yabobButtonId.c);
    return yabobButtonId;
}

export {
    convertMsToTime,
    convertMsToShortTime,
    getQueueRoles,
    logButtonPress,
    logModalSubmit,
    logSlashCommand,
    centered,
    addTimeOffset,
    getInteractionName,
    isValidChannelName,
    isValidCategoryName,
    isCategoryChannel,
    isTextChannel,
    isQueueTextChannel,
    isVoiceChannel,
    generateDMYabobButtonId,
    generateQueueYabobButtonId,
    generateOtherYabobButtonId,
    parseYabobButtonId,
    yabobButtonToString
};
