/** @module Utilities */

import {
    APIApplicationCommandOptionChoice,
    BaseMessageOptions,
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    SelectMenuInteraction
} from 'discord.js';

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

// These are just aliases to make keys of collections easier to read

/** string */
type GuildId = string;
/** string */
type GuildMemberId = string;
/** string */
type CategoryChannelId = string;
/** string */
type MessageId = string;
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

/**
 * Used in interaction handlers
 */
type CommandCallback = (
    interaction: ChatInputCommandInteraction<'cached'>
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

/**
 * SimpleEmbed return type
 */
type YabobEmbed = BaseMessageOptions;

/**
 * Location of the Actionable Component (i.e. button, modal, select menu)
 */
type YabobActionableComponentCategory = 'dm' | 'queue' | 'other';

/**
 * Actionable Component id format
 * Max length must be 100
 * Recommened total length for name is 51
 *
 * @example
 * {
 *  n: 'Join', // name of the actionable component
 *  t: 'queue', // type of actionable component, either 'dm', 'queue', or 'other'
 *  s: '12345678901234567890', // server id. if in dm, to find which server it relates to
 *  c: '12345678901234567890', // channel id. if in dm, equivalent to userId
 * }
 */
type YabobActionableComponentInfo<YabobActionableComponentCategory> = {
    /** name of the button */
    n: string;
    /** type of button, either 'dm', 'queue', or 'other' */
    t: YabobActionableComponentCategory; // max length 5
    /** server id. if in dm, to find which server it relates to */
    s: GuildId; // max length 20, 8-9 after compression
    /** channel id. if in dm, equivalent to userId */
    c: CategoryChannelId; // max length 20, 8-9 after compression
};

// type alias for better readability
/** Location of the Yabob Button */
type YabobButtonType = YabobActionableComponentCategory;
/** Yabob Button id format */
type YabobButton<YabobButtonType> = YabobActionableComponentInfo<YabobButtonType>;
/** Location of the Yabob Modal */
type YabobModalType = YabobActionableComponentCategory;
/** Yabob Modal id format */
type YabobModal<YabobModalType> = YabobActionableComponentInfo<YabobModalType>;

/** Location of the Yabob Select Menu */
type YabobSelectMenuType = YabobActionableComponentCategory;
/** Yabob Select Menu id format */
type YabobSelectMenu<YabobSelectMenuType> =
    YabobActionableComponentInfo<YabobSelectMenuType>;

// prettier-ignore
export {
    WithRequired,
    Optional,
    
    NoMethod,
    ConstNoMethod,
    
    GuildId,
    GuildMemberId,
    CategoryChannelId,
    MessageId,
    RenderIndex,
    
    HelpMessage,
    
    CommandCallback,
    QueueButtonCallback,
    DMButtonCallback,
    ModalSubmitCallback,
    DMModalSubmitCallback,
    SelectMenuCallback,
    DMSelectMenuCallback,
    
    YabobEmbed,

    YabobActionableComponentCategory,
    YabobActionableComponentInfo,

    YabobButtonType,
    YabobButton,
    YabobModalType,
    YabobModal,
    YabobSelectMenuType,
    YabobSelectMenu,
};
