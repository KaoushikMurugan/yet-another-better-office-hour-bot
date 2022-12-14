/** @module Utilities */

import {
    APIApplicationCommandOptionChoice,
    BaseMessageOptions,
    RESTPostAPIApplicationCommandsJSONBody,
    SelectMenuComponentOptionData,
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
type Result<T, E extends Error = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E };

type ServerResult<T> = Result<T, ServerError>;

type QueueResult<T> = Result<T, QueueError>;

const Ok = <T>(val: T): { ok: true; value: T } => ({ ok: true, value: val });

const Err = <E extends Error>(err: E): { ok: false; error: E } => ({
    ok: false,
    error: err
});

// These are just aliases to make keys of collections easier to read

/** string */
type GuildId = Snowflake;
/** string */
type GuildMemberId = Snowflake;
/** string */
type CategoryChannelId = Snowflake;
/** string */
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
 * - The `nameValuePair` property is utilized by the help command to display the subcommands
 * - The `useInHelpChannel` property is used to determine if the message should be displayed in the help channel
 * - The `useInHelpCommand` property is used to determine if the message can be displayed in the help command
 * - The `message` property is the actual message to be displayed
 */
type HelpMessage = {
    /**
     * Utilized by the help command to display the subcommands.
     * Structure: {name: string, value: string}
     */
    nameValuePair: APIApplicationCommandOptionChoice<string>;
    /** if the message should be displayed in the help channel */
    useInHelpChannel: boolean;
    /** if the message can be displayed in the help command */
    useInHelpCommand: boolean;
    /** The actual message to be displayed */
    message: BaseMessageOptions;
};

// Used in interaction handlers

/**
 * A function that builds the settings menu embed
 */
type SettingsMenuConstructor = (
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean,
    updateMessage: Optional<string>
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
type ComponentLocation = 'dm' | 'queue' | 'other';

/**
 * Represents an optional role id that YABOB keeps track of
 * - Snowflake or one of the SpecialRoleValues
 * - Be **very careful** with this type, it's just an alias for a string
 */
type OptionalRoleId = Snowflake | SpecialRoleValues;

enum SpecialRoleValues {
    NotSet = 'Not Set',
    Deleted = 'Deleted'
}

/** type to couple the entires of an object with the key value types */
type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * Compile time check to make sure that a enum's key and value are exactly the same
 * @example
 * ```ts
 * type A = EnsureCorrectEnum<typeof ButtonNames>;
 * ```
 */
type EnsureCorrectEnum<T extends { [K in Exclude<keyof T, number>]: K }> = true;

/** Represents 1 option inside the main settings menu */
type SettingsMenuOption = {
    /**
     * This is directly passed to the SelectMenuBuilder.addOptions method
     */
    optionData: SelectMenuComponentOptionData;
    /** A function that returns an embed of the actual menu */
    subMenu: SettingsMenuConstructor;
};

/** Type alias for interaction extensions */
type CommandData = ReadonlyArray<RESTPostAPIApplicationCommandsJSONBody>;

export {
    /** Types */
    WithRequired,
    Optional,
    OptionalRoleId,
    SpecialRoleValues,
    NoMethod,
    ConstNoMethod,
    Result,
    Ok, // these 2 arrow functions comes withe the Result<T,E> types so they are placed here
    Err,
    ServerResult,
    QueueResult,
    HelpMessage,
    Entries,
    EnsureCorrectEnum,
    SettingsMenuOption,
    CommandData,
    /** Aliases */
    GuildId,
    GuildMemberId,
    CategoryChannelId,
    MessageId,
    RenderIndex,
    TextBasedChannelId,
    /** Callback Types */
    SettingsMenuConstructor,
    /** Component Types */
    YabobEmbed,
    ComponentLocation
};
