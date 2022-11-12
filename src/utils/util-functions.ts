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
    TextChannel,
    VoiceChannel
} from 'discord.js';
import { convertBase } from 'simple-base-converter';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { cyan, magenta, yellow } from './command-line-colors.js';
import {
    YabobActionableComponentCategory,
    YabobActionableComponentInfo,
    YabobButton,
    YabobButtonType,
    YabobModal,
    YabobModalType,
    YabobSelectMenu,
    YabobSelectMenuType
} from './type-aliases.js';

/**
 * Centers a string for the console/terminal by padding it with spaces
 * @param text
 */
function centered(text: string): string {
    return (
        `${' '.repeat((process.stdout.columns - text.length) / 2)}` +
        `${text}` +
        `${' '.repeat((process.stdout.columns - text.length) / 2)}`
    );
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
 * Get the name of an interaction
 * @param interaction
 * @returns
 */
function getInteractionName(interaction: Interaction): string {
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
function logQueueButtonPress(
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
            ` - Button Pressed: ${magenta(buttonName)}\n` +
            ` - In DM`
    );
}

/**
 * Default logger for modal submits
 * @param interaction
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

function logDMModalSubmit(interaction: ModalSubmitInteraction, modalName: string): void {
    console.log(
        `[${cyan(
            new Date().toLocaleString('en-US', {
                timeZone: 'PST8PDT'
            })
        )} ` +
            `${yellow(interaction.user.username)}]\n` +
            ` - User: ${interaction.user.username} (${interaction.user.id})\n` +
            ` - Modal Used: ${magenta(modalName)}` +
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
 * Just a string with all the characters in the custom base211 alphabet
 */
const base211charecters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"αβξδεφγηιςκλμνοπθρστυωχψζΞΔΦΓΛΠΘΣΩΨάέήίϊΐόύϋΰώ£¢∞§¶•ªº≠€‹›ﬁﬂ‡°·±œ∑´®†¥¨ˆø“‘åƒ©˙˚¬…æ≈ç√∫≤≥÷Œ„‰ˇÁ∏”’»ÅÍÎÏ˝ÓÔÒÚÆ¸˛Ç◊ı˜Â¯˘¿';

/**
 * Converts a snowflake (base 10) to a base211 string
 * @param snowflake
 */
function convertSnowflakeToBase211(snowflake: string): string {
    return convertBase(snowflake, '0123456789', base211charecters);
}

/**
 * Converts a base211 string to a snowflake (base 10)
 * @param base211string
 */
function convertBase211ToSnowflake(base211string: string): string {
    return convertBase(base211string, base211charecters, '0123456789');
}

/**
 * Converts a base to another base
 * @param componentName
 * @param serverId
 * @param channelId
 * @returns a {@link YabobButton}
 */
function generateYabobActionableComponentId<T extends YabobActionableComponentCategory>(
    type: T,
    componentName: string,
    serverId: string,
    channelId: string
): YabobActionableComponentInfo<T> {
    return {
        n: componentName,
        t: type,
        s: serverId,
        c: channelId
    } as YabobButton<T>;
}

function generateYabobButtonId<T extends YabobButtonType>(
    type: T,
    buttonName: string,
    serverId: string,
    channelId: string
): YabobButton<T> {
    return generateYabobActionableComponentId(type, buttonName, serverId, channelId);
}

function generateYabobModalId<T extends YabobModalType>(
    type: T,
    modalName: string,
    serverId: string,
    channelId: string
): YabobModal<T> {
    return generateYabobActionableComponentId(type, modalName, serverId, channelId);
}

function generateSelectMenuId<T extends YabobSelectMenuType>(
    type: T,
    selectMenuName: string,
    serverId: string,
    channelId: string
): YabobSelectMenu<T> {
    return generateYabobActionableComponentId(type, selectMenuName, serverId, channelId);
}

/**
 * Converts a yabob button id to a string after converting the snowflakes to base 70
 * @param yabobButton the yabob button
 * @param noConvert turns off the conversion of the snowflakes
 * @returns
 */
function yabobActionableComponentToString(
    yabobButton: YabobActionableComponentInfo<'dm' | 'other' | 'queue'>,
    noConvert = false
): string {
    if (!noConvert) {
        yabobButton.s = convertSnowflakeToBase211(yabobButton.s);
        yabobButton.c = convertSnowflakeToBase211(yabobButton.c);
    }
    return JSON.stringify(yabobButton);
}

function yabobButtonToString(
    yabobButton: YabobButton<'dm' | 'other' | 'queue'>,
    noConvert = false
): string {
    return yabobActionableComponentToString(yabobButton, noConvert);
}

function yabobModalToString(
    yabobModal: YabobButton<'dm' | 'other' | 'queue'>,
    noConvert = false
): string {
    return yabobActionableComponentToString(yabobModal, noConvert);
}

function yabobSelectMenuToString(
    yabobSelectMenu: YabobButton<'dm' | 'other' | 'queue'>,
    noConvert = false
): string {
    return yabobActionableComponentToString(yabobSelectMenu, noConvert);
}

/**
 * Parses a yabob button id and then converts the snowflakes back to base 10
 * @param customButtonId the custom button id
 * @param noConvert turns off the conversion of the snowflakes
 * @returns
 */
function parseYabobActionableComponentId(
    customButtonId: string,
    noConvert = false
): YabobActionableComponentInfo<YabobActionableComponentCategory> {
    const yabobActionableComponentId = JSON.parse(
        customButtonId
    ) as YabobButton<YabobActionableComponentCategory>;
    if (!noConvert) {
        yabobActionableComponentId.s = convertBase211ToSnowflake(
            yabobActionableComponentId.s
        );
        yabobActionableComponentId.c = convertBase211ToSnowflake(
            yabobActionableComponentId.c
        );
    }
    return yabobActionableComponentId;
}

function parseYabobButtonId(
    customButtonId: string,
    noConvert = false
): YabobButton<YabobButtonType> {
    return parseYabobActionableComponentId(
        customButtonId,
        noConvert
    ) as YabobButton<YabobButtonType>;
}

function parseYabobModalId(
    customButtonId: string,
    noConvert = false
): YabobButton<YabobModalType> {
    return parseYabobActionableComponentId(
        customButtonId,
        noConvert
    ) as YabobButton<YabobModalType>;
}

function parseYabobSelectMenuId(
    customButtonId: string,
    noConvert = false
): YabobButton<YabobSelectMenuType> {
    return parseYabobActionableComponentId(
        customButtonId,
        noConvert
    ) as YabobButton<YabobSelectMenuType>;
}

// prettier-ignore
export {
    centered,
    convertMsToTime,
    convertMsToShortTime,
    addTimeOffset,

    getQueueRoles,
    getInteractionName,
    
    logSlashCommand,
    logQueueButtonPress,
    logDMButtonPress,
    logModalSubmit,
    logDMModalSubmit,
    
    isCategoryChannel,
    isTextChannel,
    isQueueTextChannel,
    isVoiceChannel,
    
    isValidChannelName,
    isValidCategoryName,
    
    convertSnowflakeToBase211,
    convertBase211ToSnowflake,

    generateYabobButtonId,
    generateYabobModalId,
    generateSelectMenuId,
    
    yabobButtonToString,
    yabobModalToString,
    yabobSelectMenuToString,

    parseYabobButtonId,
    parseYabobModalId,
    parseYabobSelectMenuId

};
