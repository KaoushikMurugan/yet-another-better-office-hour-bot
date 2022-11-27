import { SelectMenuInteraction, TextChannel } from 'discord.js';
import { serverSettingsMainMenuOptions } from '../attending-server/server-settings-menus.js';
import { ErrorEmbed, SelectMenuLogEmbed, SimpleEmbed } from '../utils/embed-helper.js';
import {
    DMSelectMenuCallback,
    SelectMenuCallback,
    YabobEmbed
} from '../utils/type-aliases.js';
import {
    logDMSelectMenuSelection,
    logSelectMenuSelection
} from '../utils/util-functions.js';
import { selectMenuFactory } from '../utils/component-id-factory.js';
import { isServerInteraction } from './common-validations.js';

/**
 * Responsible for handling the selection of a menu item.
 * ----
 * @category Handler Classes
 * @see
 */

/**
 * Map of server select menu names to their respective handlers
 */
const selectMenuMethodMap: {
    [selectMenuName: string]: SelectMenuCallback;
} = {
    server_settings: showSettingsSelectMenu
} as const;

/**
 * Map of dm select menu names to their respective handlers
 */
const dmSelectMenuMethodMap: {
    [selectMenuName: string]: DMSelectMenuCallback;
} = {} as const;

/**
 * List of select menus that should update the parent interaction
 */
const updateParentInteractionSelectMenus = ['server_settings'];

/**
 * Check if the select menu interaction can be handled by this (in-built) handler.
 * @remark This is the server version of the built in handler.
 * See {@link builtInDMSelectMenuHandlerCanHandle} for the dm version.
 *
 * @param interaction The interaction to check.
 * @returns True if the interaction can be handled by this handler.
 */
function builtInSelectMenuHandlerCanHandle(
    interaction: SelectMenuInteraction<'cached'>
): boolean {
    const selectMenuName = selectMenuFactory.decompressComponentId(interaction.customId)[1];
    return selectMenuName in selectMenuMethodMap;
}

/**
 * Check if the select menu interaction can be handled by this (in-built) handler.
 * @remark This is the dm version of the built in handler.
 * See {@link builtInSelectMenuHandlerCanHandle} for the server version.
 *
 * @param interaction The interaction to check.
 * @returns True if the interaction can be handled by this handler.
 */
function builtInDMSelectMenuHandlerCanHandle(
    interaction: SelectMenuInteraction
): boolean {
    const selectMenuName = selectMenuFactory.decompressComponentId(interaction.customId)[1];
    return selectMenuName in dmSelectMenuMethodMap;
}

/**
 * Handles all built in select menu interactions
 * - Calls the appropriate handler based on the modal name
 * - Logs the interaction
 * - Sends the appropriate response
 * @param interaction
 */
async function processBuiltInSelectMenu(
    interaction: SelectMenuInteraction<'cached'>
): Promise<void> {
    const selectMenuName = selectMenuFactory.decompressComponentId(interaction.customId)[1];
    const server = isServerInteraction(interaction);
    const selectMenuMethod = selectMenuMethodMap[selectMenuName];
    const updateParentInteraction =
        updateParentInteractionSelectMenus.includes(selectMenuName);
    logSelectMenuSelection(interaction, selectMenuName);
    if (!updateParentInteraction) {
        await interaction.reply(
            SimpleEmbed(`Processing your selection: \`${selectMenuName}\`...`)
        );
    }
    await selectMenuMethod?.(interaction)
        .then(async successMsg => {
            if (updateParentInteraction) {
                await interaction.update(successMsg);
            } else {
                await (interaction.replied
                    ? interaction.reply({ ...successMsg, ephemeral: true })
                    : interaction.editReply(successMsg));
            }
        })
        .catch(async (err: Error) => {
            await (interaction.replied
                ? interaction.editReply(ErrorEmbed(err, server.botAdminRoleID))
                : interaction.reply({
                      ...ErrorEmbed(err, server.botAdminRoleID),
                      ephemeral: true
                  }));
        });
}

/**
 * Handles all built in select menu interactions
 * - Calls the appropriate handler based on the modal name
 * - Sends the appropriate response
 * @param interaction
 */
async function processBuiltInDMSelectMenu(
    interaction: SelectMenuInteraction
): Promise<void> {
    const selectMenuName = selectMenuFactory.decompressComponentId(interaction.customId)[1];
    const selectMenuMethod = dmSelectMenuMethodMap[selectMenuName];
    const updateParentInteraction =
        updateParentInteractionSelectMenus.includes(selectMenuName);
    logDMSelectMenuSelection(interaction, selectMenuName);
    if (!updateParentInteraction) {
        await interaction.reply(
            SimpleEmbed(`Processing your selection: \`${selectMenuName}\`...`)
        );
    }
    await selectMenuMethod?.(interaction)
        .then(async successMsg => {
            if (updateParentInteraction) {
                await interaction.update(successMsg);
            } else {
                await (interaction.replied
                    ? interaction.reply({ ...successMsg, ephemeral: true })
                    : interaction.editReply(successMsg));
            }
        })
        .catch(async (err: Error) => {
            await (interaction.replied
                ? interaction.editReply(ErrorEmbed(err))
                : interaction.reply({
                      ...ErrorEmbed(err),
                      ephemeral: true
                  }));
        });
}

/**
 * Display the Role Config menu
 * @param interaction
 */
async function showSettingsSelectMenu(
    interaction: SelectMenuInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    const selectedOption = interaction.values[0];
    const callbackMenu = serverSettingsMainMenuOptions.find(
        option => option.optionObj.value === selectedOption
    );
    server.sendLogMessage(
        SelectMenuLogEmbed(
            interaction.user,
            `Server Settings`,
            interaction.values,
            interaction.channel as TextChannel
        )
    );
    if (!callbackMenu) {
        throw new Error(`Invalid option selected: ${selectedOption}`);
    }
    return callbackMenu.subMenu(server, interaction.channelId, false);
}

export {
    builtInSelectMenuHandlerCanHandle,
    builtInDMSelectMenuHandlerCanHandle,
    processBuiltInSelectMenu,
    processBuiltInDMSelectMenu
};
