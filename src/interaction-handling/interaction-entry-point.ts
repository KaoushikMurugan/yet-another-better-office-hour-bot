/**
 * @packageDocumentation
 * This file contains all the generic processor for all the supported
 *  types of interactions
 * - Each `process...()` function provides central error handling and logging functionalities,
 *  but no longer replies to the interaction besides the progress message
 * - The individual handlers will now decide whether they want to edit, reply, or update
 * - All the processors are using the double dispatch pattern
 *  allowing the {@link getHandler} function to act like a function factory
 */

import { Interaction, Snowflake, TextChannel } from 'discord.js';
import {
    ButtonHandlerProps,
    CommandHandlerProps,
    ModalSubmitHandlerProps,
    SelectMenuHandlerProps
} from './handler-interface.js';
import {
    ButtonLogEmbed,
    ErrorEmbed,
    SelectMenuLogEmbed,
    SimpleEmbed,
    SlashCommandLogEmbed
} from '../utils/embed-helper.js';
import { decompressComponentId } from '../utils/component-id-factory.js';
import {
    logButtonPress,
    logDMButtonPress,
    logDMModalSubmit,
    logDMSelectMenuSelection,
    logModalSubmit,
    logSelectMenuSelection,
    logSlashCommand
} from '../utils/util-functions.js';
import { baseYabobButtonMethodMap } from './button-handler.js';
import { baseYabobCommandMap } from './command-handler.js';
import { baseYabobSelectMenuMap } from './select-menu-handler.js';
import { baseYabobModalMap } from './modal-handler.js';
import { IInteractionExtension } from '../extensions/extension-interface.js';
import { isServerInteraction } from './shared-validations.js';
import { SessionCalendarInteractionExtension } from '../extensions/session-calendar/calendar-interaction-extension.js';
import { environment } from '../environment/environment-manager.js';
import { GoogleSheetInteractionExtension } from '../extensions/google-sheet-logging/google-sheet-interaction-extension.js';

/**
 * Create the interaction extension instances here
 * - states are loaded in joinGuild() in app.ts
 */
const interactionExtensions: ReadonlyArray<IInteractionExtension> =
    environment.disableExtensions
        ? []
        : [
              // Do not use async creation methods here for now bc it conflicts with client login
              new SessionCalendarInteractionExtension(),
              new GoogleSheetInteractionExtension()
          ];

/**
 * The 4-tuple of ALL supported interactions
 */
const [completeCommandMap, completeButtonMap, completeSelectMenuMap, completeModalMap] =
    combineMethodMaps(interactionExtensions);

/**
 * Determines how to reply the interaction with error
 * - reply, editReply, or update?
 * @param interaction
 * @param error
 */
async function replyWithError(
    interaction: Interaction,
    error: Error,
    botAdminRoleID: Snowflake
): Promise<void> {
    if (!interaction.isRepliable()) {
        return;
    }
    interaction.replied
        ? await interaction.editReply(ErrorEmbed(error, botAdminRoleID))
        : await interaction.reply({
              ...ErrorEmbed(error, botAdminRoleID),
              ephemeral: true
          });
}

/**
 * Process ChatInputCommandInteractions
 * @param interaction
 */
async function processChatInputCommand(interaction: Interaction): Promise<void> {
    if (!interaction.inCachedGuild() || !interaction.isChatInputCommand()) {
        return;
    }
    const commandName = interaction.commandName;
    const possibleSubcommands = interaction.options.getSubcommand(false);
    const server = isServerInteraction(interaction);
    const handleCommand = completeCommandMap.methodMap[commandName];
    logSlashCommand(interaction);
    server.sendLogMessage(SlashCommandLogEmbed(interaction));
    if (!completeCommandMap.skipProgressMessageCommands.has(commandName)) {
        await interaction.reply({
            ...SimpleEmbed(
                `Processing command \`${commandName}${
                    possibleSubcommands ? ` ${possibleSubcommands}` : ''
                }\` ...`
            ),
            ephemeral: true
        });
    }
    await handleCommand?.(interaction).catch(async (err: Error) => {
        console.error(err);
        await replyWithError(interaction, err, server.botAdminRoleID);
    });
}

/**
 * Process ButtonInteractions
 * @param interaction
 */
async function processButton(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) {
        return;
    }
    const [type, buttonName, serverId] = decompressComponentId(interaction.customId);
    // serverId might be unknown
    // TODO: Maybe require all buildComponent calls to accept only valid server id's
    const server = isServerInteraction(interaction.guildId ?? serverId);
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, buttonName, interaction.channel as TextChannel)
    );
    if (!completeButtonMap.skipProgressMessageButtons.has(buttonName)) {
        await interaction.reply({
            ...SimpleEmbed(`Processing button \`${buttonName}\`...`),
            ephemeral: true
        });
    }
    if (interaction.inCachedGuild() && type !== 'dm') {
        logButtonPress(interaction, buttonName);
        const handleModalSubmit = completeButtonMap.guildMethodMap[type][buttonName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            console.error(err);
            await replyWithError(interaction, err, server.botAdminRoleID);
        });
    } else {
        logDMButtonPress(interaction, buttonName);
        const handleModalSubmit = completeButtonMap.dmMethodMap[buttonName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            console.error(err);
            await replyWithError(interaction, err, server.botAdminRoleID);
        });
    }
}

/**
 * Process SelectMenuInteractions
 * @param interaction
 */
async function processSelectMenu(interaction: Interaction): Promise<void> {
    if (!interaction.isSelectMenu()) {
        return;
    }
    const [type, selectMenuName, serverId] = decompressComponentId(interaction.customId);
    const server = isServerInteraction(interaction.guildId ?? serverId);
    server.sendLogMessage(
        SelectMenuLogEmbed(
            interaction.user,
            selectMenuName,
            interaction.values,
            interaction.channel as TextChannel
        )
    );
    if (!completeSelectMenuMap.skipProgressMessageSelectMenus.has(selectMenuName)) {
        await interaction.reply({
            ...SimpleEmbed(`Processing button \`${selectMenuName}\``),
            ephemeral: true
        });
    }
    if (interaction.inCachedGuild() && type !== 'dm') {
        logSelectMenuSelection(interaction, selectMenuName);
        const handleSelectMenu =
            completeSelectMenuMap.guildMethodMap[type][selectMenuName];
        await handleSelectMenu?.(interaction).catch(async (err: Error) => {
            console.error(err);
            await replyWithError(interaction, err, server.botAdminRoleID);
        });
    } else {
        logDMSelectMenuSelection(interaction, selectMenuName);
        const handleSelectMenu = completeSelectMenuMap.dmMethodMap[selectMenuName];
        await handleSelectMenu?.(interaction).catch(async (err: Error) => {
            console.error(err);
            await replyWithError(interaction, err, server.botAdminRoleID);
        });
    }
}

/**
 * Process ModalSubmitInteractions
 * @param interaction
 */
async function processModalSubmit(interaction: Interaction): Promise<void> {
    if (!interaction.isModalSubmit()) {
        return;
    }
    const [type, modalName, serverId] = decompressComponentId(interaction.customId);
    const server = isServerInteraction(interaction.guildId ?? serverId);
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, modalName, interaction.channel as TextChannel)
    );
    if (interaction.inCachedGuild() && type !== 'dm') {
        logModalSubmit(interaction, modalName);
        const handleModalSubmit = completeModalMap.guildMethodMap[type][modalName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            console.error(err);
            await replyWithError(interaction, err, server.botAdminRoleID);
        });
    } else {
        logDMModalSubmit(interaction, modalName);
        const handleModalSubmit = completeModalMap.dmMethodMap[modalName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            console.error(err);
            await replyWithError(interaction, err, server.botAdminRoleID);
        });
    }
}

/**
 * Fallback handler for unsupported interactions
 * @param interaction unsupported interaction
 */
async function unsupportedInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isRepliable()) {
        await interaction.reply(
            SimpleEmbed('This interaction is currently not supported')
        );
    }
}

/**
 * Higher order function that abstracts away all the conditionals needed to find the correct handler
 * - getHandler and all the processors use the double dispatch pattern
 * @param interaction
 * @returns the handler function that can be invoked with any interaction
 */
function getHandler(interaction: Interaction): (i: Interaction) => Promise<void> {
    if (interaction.isChatInputCommand()) {
        return processChatInputCommand;
    }
    if (interaction.isModalSubmit()) {
        return processModalSubmit;
    }
    if (interaction.isSelectMenu()) {
        return processSelectMenu;
    }
    if (interaction.isButton()) {
        return processButton;
    }
    return unsupportedInteraction;
}

/**
 * Combines all the method maps from base yabob and all the extensions
 * - This function should only be called once during startup
 * @param interactionExtensions interaction extensions
 * @returns 4-tuple of command, button, select menu, and modal maps
 */
function combineMethodMaps(
    interactionExtensions: ReadonlyArray<IInteractionExtension>
): [
    CommandHandlerProps,
    ButtonHandlerProps,
    SelectMenuHandlerProps,
    ModalSubmitHandlerProps
] {
    if (interactionExtensions.length === 0) {
        return [
            baseYabobCommandMap,
            baseYabobButtonMethodMap,
            baseYabobSelectMenuMap,
            baseYabobModalMap
        ];
    }
    const completeCommandMap: CommandHandlerProps = {
        methodMap: {
            ...baseYabobCommandMap.methodMap,
            ...interactionExtensions
                .flatMap(ext => ext.commandMap)
                .map(m => m.methodMap)
                .reduce((prev, curr) => Object.assign(prev, curr))
        },
        skipProgressMessageCommands: new Set([
            ...baseYabobCommandMap.skipProgressMessageCommands,
            ...interactionExtensions
                .flatMap(ext => ext.commandMap.skipProgressMessageCommands)
                .flatMap(set => [...set.values()])
        ])
    };
    const completeButtonMap: ButtonHandlerProps = {
        guildMethodMap: {
            queue: {
                ...baseYabobButtonMethodMap.guildMethodMap.queue,
                ...interactionExtensions
                    .flatMap(ext => ext.buttonMap)
                    .map(buttonMap => buttonMap.guildMethodMap.queue)
                    .reduce((prev, curr) => Object.assign(prev, curr))
            },
            other: {
                ...baseYabobButtonMethodMap.guildMethodMap.other,
                ...interactionExtensions
                    .flatMap(ext => ext.buttonMap)
                    .map(buttonMap => buttonMap.guildMethodMap.other)
                    .reduce((prev, curr) => Object.assign(prev, curr))
            }
        },
        dmMethodMap: {
            ...baseYabobButtonMethodMap.dmMethodMap,
            ...interactionExtensions
                .flatMap(ext => ext.buttonMap)
                .map(buttonMap => buttonMap.dmMethodMap)
                .reduce((prev, curr) => Object.assign(prev, curr))
        },
        skipProgressMessageButtons: new Set([
            ...baseYabobButtonMethodMap.skipProgressMessageButtons,
            ...interactionExtensions
                .flatMap(ext => ext.buttonMap.skipProgressMessageButtons)
                .flatMap(set => [...set.values()])
        ])
    };
    const completeSelectMenuMap: SelectMenuHandlerProps = {
        guildMethodMap: {
            queue: {
                ...baseYabobSelectMenuMap.guildMethodMap.queue,
                ...interactionExtensions
                    .flatMap(ext => ext.selectMenuMap)
                    .map(selectMenuMap => selectMenuMap.guildMethodMap.queue)
                    .reduce((prev, curr) => Object.assign(prev, curr))
            },
            other: {
                ...baseYabobSelectMenuMap.guildMethodMap.other,
                ...interactionExtensions
                    .flatMap(ext => ext.selectMenuMap)
                    .map(selectMenuMap => selectMenuMap.guildMethodMap.other)
                    .reduce((prev, curr) => Object.assign(prev, curr))
            }
        },
        dmMethodMap: {
            ...baseYabobSelectMenuMap.dmMethodMap,
            ...interactionExtensions
                .flatMap(ext => ext.selectMenuMap)
                .map(selectMenuMap => selectMenuMap.dmMethodMap)
                .reduce((prev, curr) => Object.assign(prev, curr))
        },
        skipProgressMessageSelectMenus: new Set([
            ...baseYabobSelectMenuMap.skipProgressMessageSelectMenus,
            ...interactionExtensions
                .flatMap(ext => ext.selectMenuMap.skipProgressMessageSelectMenus)
                .flatMap(set => [...set.values()])
        ])
    };
    const completeModalMap: ModalSubmitHandlerProps = {
        guildMethodMap: {
            queue: {
                ...baseYabobModalMap.guildMethodMap.queue,
                ...interactionExtensions
                    .flatMap(ext => ext.modalMap)
                    .map(modalMap => modalMap.guildMethodMap.queue)
                    .reduce((prev, curr) => Object.assign(prev, curr))
            },
            other: {
                ...baseYabobModalMap.guildMethodMap.other,
                ...interactionExtensions
                    .flatMap(ext => ext.modalMap)
                    .map(modalMap => modalMap.guildMethodMap.other)
                    .reduce((prev, curr) => Object.assign(prev, curr))
            }
        },
        dmMethodMap: {
            ...baseYabobModalMap.dmMethodMap,
            ...interactionExtensions
                .flatMap(ext => ext.modalMap)
                .map(selectMenuMap => selectMenuMap.dmMethodMap)
                .reduce((prev, curr) => Object.assign(prev, curr))
        }
    };
    return [
        completeCommandMap,
        completeButtonMap,
        completeSelectMenuMap,
        completeModalMap
    ];
}

export { getHandler, interactionExtensions };
