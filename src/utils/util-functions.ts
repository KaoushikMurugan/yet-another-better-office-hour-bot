/** @module Utilities */

import {
    ButtonInteraction,
    CategoryChannel,
    ChannelType,
    ChatInputCommandInteraction,
    GuildBasedChannel,
    GuildMember,
    Interaction,
    ModalSubmitInteraction,
    Role,
    SelectMenuInteraction,
    TextChannel,
    VoiceChannel,
    VoiceState
} from 'discord.js';
import { black, cyan, magenta, yellow } from './command-line-colors.js';
import { WithRequired } from './type-aliases.js';
import { FrozenServer } from '../extensions/extension-utils.js';
import { environment } from '../environment/environment-manager.js';

/**
 * Centers a string for the console/terminal by padding it with spaces
 * @param text
 */
function centered(text: string): string {
    const padding = (process.stdout.columns - text.length) / 2;
    if (padding <= 0) {
        return text;
    }
    return `${' '.repeat(padding)}${text}${' '.repeat(padding)}`;
}

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
 * Adds `hours` : `minutes` to `date`
 * @param date
 * @param hours
 * @param minutes
 * @returns
 */
function addTimeOffset(date: Date, hours: number, minutes: number): Date {
    // might have problems with daylight saving
    return new Date(date.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000);
}

/**
 * Gets all the queue roles of a member
 * @param server
 * @param member
 * @returns list of queue roles
 */
async function getQueueRoles(server: FrozenServer, member: GuildMember): Promise<Role[]> {
    const queueChannels = await server.getQueueChannels();
    return [
        ...member.roles.cache
            .filter(role => queueChannels.some(queue => queue.queueName === role.name))
            .values()
    ];
}

/**
 * Get the name of an interaction
 * @param interaction
 * @returns
 */
function getInteractionName(interaction: Interaction): string {
    if (interaction.isCommand()) {
        return interaction.commandName;
    }
    if (interaction.isButton()) {
        return interaction.component?.label ?? interaction.customId;
    }
    if (interaction.isModalSubmit()) {
        return interaction.customId;
    }
    return 'Unsupported Interaction Type';
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

/**
 * Default logger for button presses
 * @param interaction
 * @param buttonName
 * @param queueName
 */
function logButtonPress(
    interaction: ButtonInteraction<'cached'>,
    buttonName: string,
    queueName?: string
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
            ` - Button Pressed: ${magenta(buttonName)}` +
            (queueName === undefined ? `\n - In Queue: ${queueName}` : '')
    );
}

/**
 * Default logger for dm button presses
 * @param interaction
 * @param buttonName
 */
function logDMButtonPress(interaction: ButtonInteraction, buttonName: string): void {
    console.log(
        `[${cyan(
            new Date().toLocaleString('en-US', {
                timeZone: 'PST8PDT'
            })
        )} ` +
            `${yellow(interaction.user.username)}]\n` +
            ` - User: ${interaction.user.username} (${interaction.user.id})\n` +
            ` - Related Server Id: ${interaction.guildId}\n` +
            ` - Button Pressed: ${magenta(buttonName)}\n` +
            ` - In DM`
    );
}

/**
 * Default logger for modal submits
 * @param interaction
 * @param modalName
 */
function logModalSubmit(
    interaction: ModalSubmitInteraction<'cached'>,
    modalName: string
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
            ` - Modal Used: ${magenta(modalName)}`
    );
}

/**
 * Default logger for dm modal submits
 * @param interaction
 * @param modalName
 */
function logDMModalSubmit(interaction: ModalSubmitInteraction, modalName: string): void {
    console.log(
        `[${cyan(
            new Date().toLocaleString('en-US', {
                timeZone: 'PST8PDT'
            })
        )} ` +
            `${yellow(interaction.user.username)}]\n` +
            ` - User: ${interaction.user.username} (${interaction.user.id})\n` +
            ` - Related Server Id: ${interaction.guildId}\n` +
            ` - Modal Used: ${magenta(modalName)}` +
            ` - In DM`
    );
}

/**
 * Default logger for select menu selections
 * @param interaction
 * @param selectMenuName
 */
function logSelectMenuSelection(
    interaction: SelectMenuInteraction<'cached'>,
    selectMenuName: string
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
            ` - Select Menu Used: ${magenta(selectMenuName)}` +
            ` - Selected Options: ${magenta(interaction.values.join(', '))}`
    );
}

/**
 * Default logger for dm select menu selections
 * @param interaction
 * @param selectMenuName
 */
function logDMSelectMenuSelection(
    interaction: SelectMenuInteraction,
    selectMenuName: string
): void {
    console.log(
        `[${cyan(
            new Date().toLocaleString('en-US', {
                timeZone: 'PST8PDT'
            })
        )} ` +
            `${yellow(interaction.user.username)}]\n` +
            ` - User: ${interaction.user.username} (${interaction.user.id})\n` +
            ` - Related Server Id: ${interaction.guildId}\n` +
            ` - Select Menu Used: ${magenta(selectMenuName)}` +
            ` - Selected Options: ${magenta(interaction.values.join(', '))}` +
            ` - In DM`
    );
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

/**
 * Narrows the type down to text channel
 * @param channel
 * @returns
 */
function isVoiceChannel(
    channel: GuildBasedChannel | null | undefined
): channel is VoiceChannel {
    return !!channel && channel.type === ChannelType.GuildVoice;
}

/**
 * Returns true if `channelName` can be used as a discord channel name
 * @param channelName
 */
function isValidChannelName(channelName: string): boolean {
    const invalidCharacters = /[ `!@#$%^&*()+=[\]{};':"\\|,.<>/?~]/;
    return (
        channelName.length <= 100 &&
        channelName.length > 0 &&
        !invalidCharacters.test(channelName)
    );
}

/**
 * Returns true if `categoryName` can be used as a discord category name
 * @param categoryName
 */
function isValidCategoryName(categoryName: string): boolean {
    return (
        categoryName.length <= 100 &&
        categoryName.length > 0 &&
        categoryName.trim().length > 0
    );
}

/**
 * Prints the title message for the console upon startup
 */
function printTitleString(): void {
    const titleString = 'YABOB: Yet-Another-Better-OH-Bot V4.2';
    console.log(`Environment: ${cyan(environment.env)}`);
    console.log(
        `\n${black(
            magenta(
                ' '.repeat(
                    Math.max((process.stdout.columns - titleString.length) / 2, 0)
                ) +
                    titleString +
                    ' '.repeat(
                        Math.max((process.stdout.columns - titleString.length) / 2, 0)
                    ),
                'Bg'
            )
        )}\n`
    );
    console.log('Scanning servers I am a part of...');
}

function isLeaveVC(
    oldVoiceState: VoiceState,
    newVoiceState: VoiceState
): oldVoiceState is WithRequired<VoiceState, 'channel'> {
    return oldVoiceState.channel !== null && newVoiceState.channel === null;
}

function isJoinVC(
    oldVoiceState: VoiceState,
    newVoiceState: VoiceState
): newVoiceState is WithRequired<VoiceState, 'channel'> {
    return oldVoiceState.channel === null && newVoiceState.channel !== null;
}

export {
    /** Util Functions */
    addTimeOffset,
    centered,
    printTitleString,
    /** Type Guards */
    isLeaveVC,
    isJoinVC,
    isCategoryChannel,
    isQueueTextChannel,
    isTextChannel,
    isVoiceChannel,
    isValidCategoryName,
    isValidChannelName,
    /** Getters */
    getQueueRoles,
    getInteractionName,
    /** Parsers */
    /** Converters */
    convertMsToShortTime,
    convertMsToTime,
    /** Loggers */
    logDMSelectMenuSelection,
    logSlashCommand,
    logButtonPress,
    logDMButtonPress,
    logDMModalSubmit,
    logModalSubmit,
    logSelectMenuSelection
};
