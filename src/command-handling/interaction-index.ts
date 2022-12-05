/**
 * @packageDocumentation
 * This file is only used for re-exports of all the exported command handler methods
 *  in ./command-handling
 */

import { Collection, Interaction } from 'discord.js';
import { IInteractionExtension } from '../extensions/extension-interface.js';
import { SimpleEmbed } from '../utils/embed-helper.js';
import { GuildId } from '../utils/type-aliases.js';
import {
    builtInCommandHandlerCanHandle,
    processBuiltInCommand
} from './command/command-handler.js';
import {
    builtInDMButtonHandlerCanHandle,
    processBuiltInDMButton,
    builtInButtonHandlerCanHandle,
    processBuiltInButton
} from './message-component/button-handler.js';
import {
    builtInDMSelectMenuHandlerCanHandle,
    processBuiltInDMSelectMenu,
    builtInSelectMenuHandlerCanHandle,
    processBuiltInSelectMenu
} from './message-component/select-menu-handler.js';
import {
    builtInDMModalHandlerCanHandle,
    processBuiltInDMModalSubmit,
    builtInModalHandlerCanHandle,
    processBuiltInModalSubmit
} from './modal/modal-handler.js';

const interactionExtensions = new Collection<GuildId, IInteractionExtension[]>();

/**
 * Dispatches the ineraction to different handlers.
 * @remark This is for dm interactions only. See {@link dispatchServerInteractions}
 * for the server interaction dispatcher
 * @param interaction must be DM based
 * @returns boolean, whether the command was handled
 */
async function dispatchDMInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.isButton()) {
        if (builtInDMButtonHandlerCanHandle(interaction)) {
            await processBuiltInDMButton(interaction);
            return true;
        } else {
            const externalDMButtonHandler = interactionExtensions
                .get(interaction.customId)
                ?.find(ext => ext.canHandleDMButton(interaction));
            await externalDMButtonHandler?.processDMButton(interaction);
            return externalDMButtonHandler !== undefined;
        }
    } else if (interaction.isModalSubmit()) {
        if (builtInDMModalHandlerCanHandle(interaction)) {
            await processBuiltInDMModalSubmit(interaction);
            return true;
        } else {
            const externalDMModalHandler = interactionExtensions
                .get(interaction.customId)
                ?.find(ext => ext.canHandleDMModalSubmit(interaction));
            await externalDMModalHandler?.processDMModalSubmit(interaction);
            return externalDMModalHandler !== undefined;
        }
    } else if (interaction.isSelectMenu()) {
        if (builtInDMSelectMenuHandlerCanHandle(interaction)) {
            await processBuiltInDMSelectMenu(interaction);
            return true;
        } else {
            const externalDMSelectMenuHandler = interactionExtensions
                .get(interaction.customId)
                ?.find(ext => ext.canHandleDMSelectMenu(interaction));
            await externalDMSelectMenuHandler?.processDMSelectMenu(interaction);
            return externalDMSelectMenuHandler !== undefined;
        }
    } else {
        interaction.isRepliable() &&
            (await interaction.reply(
                SimpleEmbed('I can not process this DM interaction.')
            ));
        return false;
    }
}

/**
 * Dispatches the interaction to different handlers.
 * @remark This is for server interactions only. See {@link dispatchDMInteraction}
 * for the dm interaction dispatcher
 * @param interaction must be server based
 * @returns boolean, whether the command was handled
 */
async function dispatchServerInteractions(
    interaction: Interaction<'cached'>
): Promise<boolean> {
    // if it's a built-in command/button, process
    // otherwise find an extension that can process it
    if (interaction.isChatInputCommand()) {
        if (builtInCommandHandlerCanHandle(interaction)) {
            await processBuiltInCommand(interaction);
            return true;
        } else {
            const externalCommandHandler = interactionExtensions
                // default value is for semantics only
                .get(interaction.guildId)
                ?.find(ext => ext.canHandleCommand(interaction));
            await externalCommandHandler?.processCommand(interaction);
            return externalCommandHandler !== undefined;
        }
    } else if (interaction.isButton()) {
        if (builtInButtonHandlerCanHandle(interaction)) {
            await processBuiltInButton(interaction);
            return true;
        } else {
            const externalButtonHandler = interactionExtensions
                .get(interaction.guildId)
                ?.find(ext => ext.canHandleButton(interaction));
            await externalButtonHandler?.processButton(interaction);
            return externalButtonHandler !== undefined;
        }
    } else if (interaction.isModalSubmit()) {
        if (builtInModalHandlerCanHandle(interaction)) {
            await processBuiltInModalSubmit(interaction);
            return true;
        } else {
            const externalModalHandler = interactionExtensions
                .get(interaction.guildId)
                ?.find(ext => ext.canHandleModalSubmit(interaction));
            await externalModalHandler?.processModalSubmit(interaction);
            return externalModalHandler !== undefined;
        }
    } else if (interaction.isSelectMenu()) {
        if (builtInSelectMenuHandlerCanHandle(interaction)) {
            await processBuiltInSelectMenu(interaction);
            return true;
        } else {
            const externalSelectMenuHandler = interactionExtensions
                .get(interaction.guildId)
                ?.find(ext => ext.canHandleSelectMenu(interaction));
            await externalSelectMenuHandler?.processSelectMenu(interaction);
            return externalSelectMenuHandler !== undefined;
        }
    }
    return false;
}

export { interactionExtensions, dispatchDMInteraction, dispatchServerInteractions };
