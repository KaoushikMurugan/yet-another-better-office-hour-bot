import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    SelectMenuInteraction
} from 'discord.js';
import {
    CommandCallback,
    DMButtonCallback,
    DMModalSubmitCallback,
    DMSelectMenuCallback,
    ModalSubmitCallback,
    RegularButtonCallback,
    SelectMenuCallback
} from '../utils/type-aliases.js';
import { QueueButtonCallback } from '../../dist/src/utils/type-aliases.js';

/**
 * The information needed for the generic command interaction handler
 */
interface CommandHandlerProps {
    /** Commands that return an embed
     */
    regularCommands: { [commandName: string]: CommandCallback };
    /** Commands that will always REPLY inside the function body */
    requireFirstResponseCommands: {
        [commandName: string]: (
            i: ChatInputCommandInteraction<'cached'>
        ) => Promise<undefined>;
    };
}

/**
 * The information needed for the generic button interaction handler
 */
interface ButtonHandlerProps {
    /** Buttons inside #queue channels */
    queueButtons: { [buttonName: string]: QueueButtonCallback };
    /** Regular buttons in a guild that return an embed */
    regularButtons: { [buttonName: string]: RegularButtonCallback };
    /** Buttons that will always REPLY inside the handler function body */
    requireFirstResponseButtons: {
        [buttonName: string]: (i: ButtonInteraction<'cached'>) => Promise<undefined>;
    };
    /** Buttons that need to update the previous interaction */
    updateParentInteractionButtons: { [buttonName: string]: RegularButtonCallback };
    /** Buttons that show up in DM channels */
    dmButtons: { [buttonName: string]: DMButtonCallback };
}

interface SelectMenuHandlerProps {
    /** Regular guild based select menus */
    regularSelectMenus: { [selectMenuName: string]: SelectMenuCallback };
    /** Select menus that will always REPLY inside the handler function body */
    requireFirstResponseSelectMenus: {
        [selectMenuName: string]: (
            i: SelectMenuInteraction<'cached'>
        ) => Promise<undefined>;
    };
    /** Select Menus that need to update the previous interaction */
    updateParentInteractionSelectMenus: { [selectMenuName: string]: SelectMenuCallback };
    /** Select Menus that show up in DM channels */
    dmSelectMenus: { [selectMenuName: string]: DMSelectMenuCallback };
}

interface ModalSubmitHandlerProps {
    /** Regular guild based modals */
    regularModals: { [modalName: string]: ModalSubmitCallback };
    /** Modals that will always REPLY inside the hdndler function body */
    updateParentInterfactionModals: {
        [modalName: string]: (i: ModalSubmitInteraction<'cached'>) => Promise<undefined>;
    };
    /** modals inside DM channels */
    dmModals: { [modalName: string]: DMModalSubmitCallback };
}

export {
    CommandHandlerProps,
    ButtonHandlerProps,
    SelectMenuHandlerProps,
    ModalSubmitHandlerProps
};
