/** @module Utilities */

import {
    APIApplicationCommandOptionChoice,
    BaseMessageOptions,
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction
} from 'discord.js';

/**
 * These are just aliases to make keys of collections easier to read
 */
type GuildId = string;
type GuildMemberId = string;
type CategoryChannelId = string;
type RenderIndex = number;
type MessageId = string;

type HelpMessage = {
    nameValuePair: APIApplicationCommandOptionChoice<string>;
    useInHelpChannel: boolean; // whether it should be displayed in the help channel
    useInHelpCommand: boolean; // whether it can be shown in the help command
    message: BaseMessageOptions;
};

/**
 * Used in interaction handlers
 */
type CommandCallback = (
    interaction: ChatInputCommandInteraction<'cached'>
) => Promise<BaseMessageOptions>;
type queueButtonCallback = (
    queueName: string,
    interaction: ButtonInteraction<'cached'>
) => Promise<BaseMessageOptions>;
type dmButtonCallback = (interaction: ButtonInteraction) => Promise<BaseMessageOptions>;
type ModalSubmitCallback = (
    interaction: ModalSubmitInteraction<'cached'>
) => Promise<BaseMessageOptions>;

/**
 * Marks 1 property in T as required.
 * @see https://stackoverflow.com/questions/69327990/how-can-i-make-one-property-non-optional-in-a-typescript-type
 */
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] & NonNullable<T[P]> };
/**
 * Utility alias for T | undefined, shorter and more readable
 * @remark
 * - Use this when the `T?` syntax is unavailable such as function return types
 * - Otherwise prefer `T?`
 */
type Optional<T> = T | undefined;
/**
 * Utility alias to remove all methods from a class
 */
type NoMethod<T> = Pick<
    T,
    // disabling this warning is safe because we are removing all functions
    // eslint-disable-next-line @typescript-eslint/ban-types
    { [K in keyof T]: T[K] extends Function ? never : K }[keyof T]
>;
type ConstNoMethod<T> = Readonly<NoMethod<T>>;
/**
 * SimpleEmbed return type
 */
type YabobEmbed = BaseMessageOptions;

/**
 * Button id format
 * Max length must be 100
 * Recommened length for
 * 
 * @example
 * {
 *  n: 'Join',
 *  t: 'queue',
 *  s: '12345678901234567890',
 *  c: '12345678901234567890',
 *  q: 'queue name'
 * }
 */
type YabobButton<ButtonType extends 'dm' | 'queue' | 'other'> = {
    /** name of the button */
    n: string;
    /** type of button, either 'dm', 'queue', or 'other' */
    t: ButtonType; // max length 5
    /** server id. if in dm, to find which server it relates to */
    s: string; // max length 20
    /** channel id. if in dm, equivalent to userId */
    c: string; // max length 20
    /** queue name */
    q: ButtonType extends 'queue' ? string : undefined; // max length 100
};

export {
    GuildId,
    GuildMemberId,
    CategoryChannelId,
    RenderIndex,
    MessageId,
    HelpMessage,
    CommandCallback,
    queueButtonCallback,
    dmButtonCallback,
    WithRequired,
    Optional,
    ModalSubmitCallback,
    YabobEmbed,
    YabobButton,
    NoMethod,
    ConstNoMethod
};
