/** @module Utilities */

import {
    APIApplicationCommandOptionChoice,
    BaseMessageOptions,
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    SelectMenuInteraction,
    Snowflake
} from 'discord.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { QueueError, ServerError } from './error-types.js';

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
 * Remove all methods from a class
 */
type NoMethod<T> = Pick<
    T,
    // disabling this warning is safe because we are removing all functions
    // eslint-disable-next-line @typescript-eslint/ban-types
    { [K in keyof T]: T[K] extends Function ? never : K }[keyof T]
>;

type ConstNoMethod<T> = Readonly<NoMethod<T>>;

/**
 * Non exception based error types
 */
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

type ServerResult<T> = Result<T, ServerError>;

type QueueResult<T> = Result<T, QueueError>;

// These are just aliases to make keys of collections easier to read

/** string */
type GuildId = Snowflake;
/** string */
type GuildMemberId = Snowflake;
/** string */
type CategoryChannelId = Snowflake;
/** str */
type TextBasedChannelId = Snowflake;
/** string */
type MessageId = Snowflake;
/** number */
type RenderIndex = number;

/**
 * Help message type
 * @remark
 * - This is used to store help messages in the help channel
 * - It is also used to store help messages in the help command
 * - The `nameValuePair` property is utlized by the help command to display the subcommands
 * - The `useInHelpChannel` property is used to determine if the message should be displayed in the help channel
 * - The `useInHelpCommand` property is used to determine if the message can be displayed in the help command
 * - The `message` property is the actual message to be displayed
 */
type HelpMessage = {
    /**
     * Utlized by the help command to display the subcommands.
     *
     * Structure: {name: string, value: string}
     */
    nameValuePair: APIApplicationCommandOptionChoice<string>;
    /** Used to determine if the message should be displayed in the help channel */
    useInHelpChannel: boolean;
    /** Used to determine if the message can be displayed in the help command */
    useInHelpCommand: boolean;
    /** The actual message to be displayed */
    message: BaseMessageOptions;
};

// Used in interaction handlers

type CommandCallback = (
    interaction: ChatInputCommandInteraction<'cached'>
) => Promise<BaseMessageOptions>;

type DefaultButtonCallback = (
    interaction: ButtonInteraction<'cached'>
) => Promise<BaseMessageOptions>;

type QueueButtonCallback = (
    queueName: string,
    interaction: ButtonInteraction<'cached'>
) => Promise<BaseMessageOptions>;

type DMButtonCallback = (interaction: ButtonInteraction) => Promise<BaseMessageOptions>;

type ModalSubmitCallback = (
    interaction: ModalSubmitInteraction<'cached'>
) => Promise<BaseMessageOptions>;

type DMModalSubmitCallback = (
    interaction: ModalSubmitInteraction
) => Promise<BaseMessageOptions>;

type SelectMenuCallback = (
    interaction: SelectMenuInteraction<'cached'>
) => Promise<BaseMessageOptions>;

type DMSelectMenuCallback = (
    interaction: SelectMenuInteraction
) => Promise<BaseMessageOptions>;

type SettingsMenuCallback = (
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
) => BaseMessageOptions;

/**
 * SimpleEmbed return type
 */
type YabobEmbed = BaseMessageOptions;

/**
 * Location of the Actionable Component (i.e. button, modal, select menu)
 * 'dm' - component is in a DM
 * 'queue' - component is in a queue channel
 * 'other' - component is in a non-queue guild channel
 */
type YabobComponentType = 'dm' | 'queue' | 'other';
/**
 * Actionable Component id format
 * Max length must be 100
 * Max length allowed for name is 58
 *
 * @example
 * {
 *  n: 'Join', // name of the actionable component
 *  t: 'queue', // type of actionable component, either 'dm', 'queue', or 'other'
 *  s: '12345678901234567890', // server id. if in dm, to find which server it relates to
 *  c: '12345678901234567890', // channel id. if in dm, equivalent to userId
 * }
 */
type YabobComponentId<T extends YabobComponentType> = {
    /** name of the button */
    name: string;
    /** type of button, either 'dm', 'queue', or 'other' */
    type: T; // max length 5
    /** server id. if in dm, to find which server it relates to */
    sid: T extends 'dm' ? GuildId : undefined; // max length 20, 8-9 after compression
    /** channel id. if in dm, equivalent to userId */
    cid: T extends 'other' ? undefined : CategoryChannelId; // max length 20, 8-9 after compression
};

// type alias for better readability

/** Yabob Button id format */
type YabobButtonId<T extends YabobComponentType> = YabobComponentId<T>;

/** Yabob Modal id format */
type YabobModalId<T extends YabobComponentType> = YabobComponentId<T>;

/** Yabob Select Menu id format */
type YabobSelectMenuId<T extends YabobComponentType> = YabobComponentId<T>;

/**
 * Represents an optional role id that YABOB keeps track of
 * - Be **very careful** with this type, it's just an alias for a string
 */
type OptionalRoleId = Snowflake | 'Not Set' | 'Deleted';

/** type to couple the entires of an object with the key value types */
type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];

export {
    /** Types */
    WithRequired,
    Optional,
    OptionalRoleId,
    NoMethod,
    ConstNoMethod,
    Result,
    ServerResult,
    QueueResult,
    HelpMessage,
    Entries,
    /** Aliases */
    GuildId,
    GuildMemberId,
    CategoryChannelId,
    MessageId,
    RenderIndex,
    TextBasedChannelId,
    /** Callback Types */
    CommandCallback,
    DefaultButtonCallback,
    QueueButtonCallback,
    DMButtonCallback,
    ModalSubmitCallback,
    DMModalSubmitCallback,
    SelectMenuCallback,
    DMSelectMenuCallback,
    SettingsMenuCallback,
    /** Component Types */
    YabobEmbed,
    YabobComponentType,
    YabobComponentId,
    YabobButtonId,
    YabobModalId,
    YabobSelectMenuId
};
