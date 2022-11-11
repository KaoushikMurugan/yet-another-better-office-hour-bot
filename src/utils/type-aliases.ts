/** @module Utilities */

import {
    APIApplicationCommandOptionChoice,
    BaseMessageOptions,
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction
} from 'discord.js';
import { SimpleEmbed } from './embed-helper.js';
import { QueueError, ServerError } from './error-types.js';

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
type ButtonCallback = (
    queueName: string,
    interaction: ButtonInteraction<'cached'>
) => Promise<BaseMessageOptions>;
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

/**
 * Alias for readonly no method
 */
type ConstNoMethod<T> = Readonly<NoMethod<T>>;

/**
 * SimpleEmbed return type
 */
type YabobEmbed = ReturnType<typeof SimpleEmbed>;

/**
 * Non exception based error types
 */
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
type ServerResult<T> = Result<T, ServerError>;
type QueueResult<T> = Result<T, QueueError>;

export {
    GuildId,
    GuildMemberId,
    CategoryChannelId,
    RenderIndex,
    MessageId,
    HelpMessage,
    CommandCallback,
    ButtonCallback,
    WithRequired,
    Optional,
    ModalSubmitCallback,
    YabobEmbed,
    NoMethod,
    ConstNoMethod,
    Result,
    ServerResult,
    QueueResult
};
