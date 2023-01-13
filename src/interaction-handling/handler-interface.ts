import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    SelectMenuInteraction
} from 'discord.js';

/** ChatInputCommands can only exist in guilds, so we can assume it will always be cached */
type CommandHandler = (
    interaction: ChatInputCommandInteraction<'cached'>
) => Promise<void>;

type GuildButtonHandler = (interaction: ButtonInteraction<'cached'>) => Promise<void>;

type DMButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

type GuildSelectMenuHandler = (
    interaction: SelectMenuInteraction<'cached'>
) => Promise<void>;

type DMSelectMenuHandler = (interaction: SelectMenuInteraction) => Promise<void>;

type GuildModalSubmitHandler = (
    interaction: ModalSubmitInteraction<'cached'>
) => Promise<void>;

type DMModalSubmitHandler = (interaction: ModalSubmitInteraction) => Promise<void>;

/**
 * The information needed for the generic command interaction handler
 */
interface CommandHandlerProps {
    /** All the commands, always in guild */
    methodMap: { readonly [commandName: string]: CommandHandler };
    /**
     * Commands that will REPLY/UPDATE inside the function body
     * - If a handler reply/updates in the function body but doesn't have its name here,
     *  it will cause the InteractionAlreadyReplied Error
     */
    skipProgressMessageCommands: Set<string>;
}

/**
 * The information needed for the generic button interaction handler
 */
interface ButtonHandlerProps {
    /** All the guild buttons, queue and other doesn't have type level differences */
    guildMethodMap: {
        /** Buttons that appear in queue channels */
        queue: { readonly [buttonName: string]: GuildButtonHandler };
        /** Other guild buttons */
        other: { readonly [buttonName: string]: GuildButtonHandler };
    };
    /** All the DM buttons */
    dmMethodMap: { readonly [buttonName: string]: DMButtonHandler };
    /**
     * Buttons that will REPLY/UPDATE inside the function body
     * - If a handler reply/updates in the function body but doesn't have its name here,
     *  it will cause the InteractionAlreadyReplied Error
     */
    skipProgressMessageButtons: Set<string>;
}

/**
 * The information needed for the generic select menu handler
 */
interface SelectMenuHandlerProps {
    /** All the guild select menus */
    guildMethodMap: {
        /** Select Menus that appear in queue channels */
        queue: { readonly [selectMenuName: string]: GuildSelectMenuHandler };
        /** Other guild select menus */
        other: { readonly [selectMenuName: string]: GuildSelectMenuHandler };
    };
    /** All the DM select menus */
    dmMethodMap: { readonly [selectMenuName: string]: DMSelectMenuHandler };
    /**
     * Select menus that will REPLY/UPDATE inside the function body
     * - If a handler reply/updates in the function body but doesn't have its name here,
     *  it will cause the InteractionAlreadyReplied Error
     */
    skipProgressMessageSelectMenus: Set<string>;
}

/**
 * The information needed for the generic modal submit handler
 * - All handler functions must REPLY / UPDATE inside the function body
 */
interface ModalSubmitHandlerProps {
    /** All the guild modals */
    guildMethodMap: {
        /** Modals that appear in queue channels */
        queue: { readonly [modalName: string]: GuildModalSubmitHandler };
        /** Other guild modals */
        other: { readonly [modalName: string]: GuildModalSubmitHandler };
    };
    /** All the DM modals */
    dmMethodMap: { readonly [modalName: string]: DMModalSubmitHandler };
}

export type {
    CommandHandlerProps,
    ButtonHandlerProps,
    SelectMenuHandlerProps,
    ModalSubmitHandlerProps
};
