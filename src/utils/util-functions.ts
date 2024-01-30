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
    StringSelectMenuInteraction,
    TextChannel,
    VoiceBasedChannel,
    VoiceState
} from 'discord.js';
import { black, cyan, magenta, yellow } from './command-line-colors.js';
import { WithRequired } from './type-aliases.js';
import { FrozenServer } from '../extensions/extension-utils.js';
import { environment } from '../environment/environment-manager.js';
import { extractComponentName } from './component-id-factory.js';
import { LOGGER } from '../global-states.js';

// #region Util Functions

/**
 * Prints the title message for the console upon startup
 */
function printTitleString(): void {
    const titleString = 'YABOB: Yet-Another-Better-OH-Bot V4.4.1';
    LOGGER.info(`Environment: ${cyan(environment.env)}`);
    LOGGER.info(`${black(magenta(titleString, 'Bg'))}`);
    LOGGER.info('Scanning servers I am a part of...');
}

function padTo2Digits(num: number): string {
    return num.toString().padStart(2, '0');
}

/**
 * Creates a list of integers in [low, high), behaves exactly like python's range function
 * @param low lower end of the range (inclusive),
 *  if high is not specified, this is the max and 0 is used as the low end
 * @param high higher end of the range, exclusive
 * @param step step size, defaults to 1, requires all params to be specified
 * @returns a list of integers
 */
function range(low: number, high?: number, step = 1): number[] {
    if (!high) {
        return Array(low)
            .fill(undefined)
            .map((_, i) => i * step);
    }
    if (step > high - low) {
        throw new Error('Step size must be <= interval size');
    }
    return Array(Math.ceil((high - low) / step))
        .fill(undefined)
        .map((_, i) => i * step + low);
}

/**
 * Converts the time delta in milliseconds into 'HH hours, MM minutes, SS seconds'
 * @param milliseconds the difference to convert
 */
function convertMsToTime(milliseconds: number): string {
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
 * Converts the time delta in milliseconds into HH:MM:SS
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

function camelCaseToTitleCase(text: string): string {
    const result = text.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
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
    return [
        ...member.roles.cache
            .filter(role =>
                server.queueChannels.some(queue => queue.queueName === role.name)
            )
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
        return (
            interaction.component.label ??
            extractComponentName(interaction.customId, true) ??
            'Button'
        );
    }
    if (interaction.isModalSubmit()) {
        return extractComponentName(interaction.customId, true) ?? 'Modal Submit';
    }
    if (interaction.isStringSelectMenu()) {
        return (
            extractComponentName(interaction.customId, true) ??
            interaction.component.placeholder ??
            'Select Menu'
        );
    }
    return 'Unsupported Interaction Type';
}

/**
 * A DP implementation that finds the length
 *  of the longest common subsequence (LCS) between 2 strings
 * @param str1 string 1
 * @param str2 string 2
 * @returns the length of LCS
 */
function longestCommonSubsequence(str1: string, str2: string): number {
    /**
     * Encodes the recurrence:
     * LCS(i, j) = {
     *      0                                   if i == str1.length or j == str2.length
     *      LCS(i + 1, j + 1)                   if str1[i] == str2[j]
     *      max(LCS(i + 1, j), LCS(i, j + 1))   if str1[i] != str2[j]
     * }
     */
    try {
        const M = str1.length;
        const N = str2.length;
        const dpTable: number[][] = [];
        for (let i = 0; i < M + 1; i++) {
            // must use a loop here,
            // using array fill on the outer array creates a bunch of inner arrays with the same reference
            dpTable.push(new Array(N + 1).fill(0));
        }
        // base cases
        for (let j = 0; j < N; j++) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            dpTable[M]![j] = 0;
        }
        for (let i = 0; i < M; i++) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            dpTable[i]![N] = 0;
        }
        for (let i = M - 1; i >= 0; i--) {
            for (let j = N - 1; j >= 0; j--) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const skipI = dpTable[i + 1]![j]!;
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const skipJ = dpTable[i]![j + 1]!;
                if (str1[i] === str2[j]) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    dpTable[i]![j] = dpTable[i + 1]![j + 1]! + 1;
                } else if (skipI > skipJ) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    dpTable[i]![j] = skipI;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    dpTable[i]![j] = skipJ;
                }
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return dpTable[0]![0]!;
    } catch {
        return -1;
    }
}

// #endregion Util Functions

// #region Loggers

/**
 * Default logger for slash commands
 * @param interaction
 */
function logSlashCommand(interaction: ChatInputCommandInteraction<'cached'>): void {
    LOGGER.info(
        {
            user: `${interaction.user.username} (${interaction.user.id})`,
            serverId: interaction.guildId,
            command: interaction.toString()
        },
        `Command used in ${yellow(interaction.guild.name)}`
    );
}

/**
 * Default logger for button presses
 * @param interaction
 * @param buttonName
 * @param queueName
 */
function logButtonPress(
    interaction: ButtonInteraction,
    buttonName: string,
    queueName?: string
): void {
    LOGGER.info(
        {
            user: `${interaction.user.username} (${interaction.user.id})`,
            serverId: interaction.guildId,
            button: buttonName,
            queueName: queueName
        },
        `Button pressed in ${yellow(interaction.guild?.name)}`
    );
}

/**
 * Default logger for dm button presses
 * @param interaction
 * @param buttonName
 */
function logDMButtonPress(interaction: ButtonInteraction, buttonName: string): void {
    LOGGER.info(
        {
            user: `${interaction.user.username} (${interaction.user.id})`,
            buttonPressed: buttonName
        },
        'Button pressed in DM channel'
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
    LOGGER.info(
        {
            user: `${interaction.user.username} (${interaction.user.id})`,
            serverId: interaction.guildId,
            modal: modalName
        },
        `Modal submitted in ${yellow(interaction.guild.name)}`
    );
}

/**
 * Default logger for dm modal submits
 * @param interaction
 * @param modalName
 */
function logDMModalSubmit(interaction: ModalSubmitInteraction, modalName: string): void {
    LOGGER.info(
        {
            user: `${interaction.user.username} (${interaction.user.id})`,
            modal: modalName
        },
        'Modal submitted in DM Channel'
    );
}

/**
 * Default logger for select menu selections
 * @param interaction
 * @param selectMenuName
 */
function logSelectMenuSelection(
    interaction: StringSelectMenuInteraction<'cached'>,
    selectMenuName: string
): void {
    LOGGER.info(
        {
            user: `${interaction.user.username} (${interaction.user.id})`,
            serverId: interaction.guildId,
            selectMenu: selectMenuName,
            selectedOptions: interaction.values.join(', ')
        },
        `Select menu used in ${yellow(interaction.guild.name)}`
    );
}

/**
 * Default logger for dm select menu selections
 * @param interaction
 * @param selectMenuName
 */
function logDMSelectMenuSelection(
    interaction: StringSelectMenuInteraction,
    selectMenuName: string
): void {
    LOGGER.info(
        {
            user: `${interaction.user.username} (${interaction.user.id})`,
            serverId: interaction.guildId,
            selectMenu: selectMenuName,
            selectedOptions: interaction.values.join(', ')
        },
        'Select menu used in DM channel'
    );
}

/**
 * Pretty prints an expected error to the console
 * @param interaction
 * @param error
 */
function logExpectedErrors(interaction: Interaction, error: Error): void {
    LOGGER.error(
        {
            user: `${interaction.user.username} (${interaction.user.id})`,
            relatedServer: `${interaction.guild?.name} (${interaction.guildId})`
        },
        error.message
    );
}

// #endregion Loggers

// #region Type Guards

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
function isVoiceBasedChannel(
    channel: GuildBasedChannel | null | undefined
): channel is VoiceBasedChannel {
    return !!channel && channel.type === ChannelType.GuildVoice;
}

/**
 * Returns true if `channelName` can be used as a discord channel name
 * @param channelName
 */
function isValidChannelName(channelName: string): boolean {
    const invalidCharacters = /[`!@#$%^&*()+=[\]{};':"\\|,.<>/?~]/;
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

function isLeaveVBC(
    oldVoiceState: VoiceState,
    newVoiceState: VoiceState
): oldVoiceState is WithRequired<VoiceState, 'channel'> {
    return oldVoiceState.channel !== null && newVoiceState.channel === null;
}

function isJoinVBC(
    oldVoiceState: VoiceState,
    newVoiceState: VoiceState
): newVoiceState is WithRequired<VoiceState, 'channel'> {
    return oldVoiceState.channel === null && newVoiceState.channel !== null;
}

// #endregion Type Guards

export {
    /** Util Functions */
    addTimeOffset,
    printTitleString,
    longestCommonSubsequence,
    padTo2Digits,
    range,
    camelCaseToTitleCase,
    /** Type Guards */
    isLeaveVBC,
    isJoinVBC,
    isCategoryChannel,
    isQueueTextChannel,
    isTextChannel,
    isVoiceBasedChannel,
    /** Validators */
    isValidCategoryName,
    isValidChannelName,
    /** Getters */
    getQueueRoles,
    getInteractionName,
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
    logSelectMenuSelection,
    logExpectedErrors
};
