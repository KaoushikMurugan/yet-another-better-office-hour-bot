/**
 * Responsible for handling the selection of a menu item.
 * ----
 * @category Handler Classes
 * @see
 */

import { SelectMenuInteraction } from 'discord.js';
import { serverRolesConfigMenu } from '../attending-server/server-config-messages.js';
import { ErrorEmbed, SimpleEmbed } from '../utils/embed-helper.js';
import { SelectMenuCallback, YabobEmbed } from '../utils/type-aliases.js';
import { parseYabobSelectMenuId } from '../utils/util-functions.js';
import { isServerInteraction } from './common-validations.js';

const selectMenuMap: {
    [selectMenuName: string]: [
        callback: SelectMenuCallback,
        updateParentInteraction: boolean
    ];
} = {
    server_settings: [serverSettingsSelectMenu, true]
};

/**
 * Check if the select menu interaction can be handled by this (in-built) handler.
 * @param interaction The interaction to check.
 * @returns True if the interaction can be handled by this handler.
 */

function builtInSelectMenuHandlerCanHandle(
    interaction: SelectMenuInteraction<'cached'>
): boolean {
    const yabobSelectMenuId = parseYabobSelectMenuId(interaction.customId);
    const selectMenuName = yabobSelectMenuId?.n;
    return selectMenuName in selectMenuMap;
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
    const yabobSelectMenuId = parseYabobSelectMenuId(interaction.customId);
    const selectMenuName = yabobSelectMenuId?.n;
    const server = isServerInteraction(interaction);
    const [selectMenuMethod, updateParentInteraction] = selectMenuMap[selectMenuName] ?? [
        undefined,
        false
    ];

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
                interaction.replied
                    ? await interaction.reply({ ...successMsg, ephemeral: true })
                    : await interaction.editReply(successMsg);
            }
        })
        .catch(async err => {
            console.error(err);
            await Promise.all([
                interaction.replied
                    ? interaction.editReply(ErrorEmbed(err, server.botAdminRoleID))
                    : interaction.reply({
                          ...ErrorEmbed(err, server.botAdminRoleID),
                          ephemeral: true
                      })
            ]);
        });
}

async function serverSettingsSelectMenu(
    interaction: SelectMenuInteraction<'cached'>
): Promise<YabobEmbed> {
    const server = isServerInteraction(interaction);
    return serverRolesConfigMenu(server, false, interaction.channelId, false);
}

export { builtInSelectMenuHandlerCanHandle, processBuiltInSelectMenu };
