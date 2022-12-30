import { SelectMenuInteraction } from 'discord.js';
import { serverSettingsMainMenuOptions } from '../attending-server/server-settings-menus.js';
import { isTextChannel } from '../utils/util-functions.js';
import { SelectMenuHandlerProps } from './handler-interface.js';
import { ExpectedParseErrors } from './interaction-constants/expected-interaction-errors.js';
import { SelectMenuNames } from './interaction-constants/interaction-names.js';
import { isServerInteraction } from './shared-validations.js';

const baseYabobSelectMenuMap: SelectMenuHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [SelectMenuNames.ServerSettings]: showSettingsSelectMenu,
            [SelectMenuNames.SelectLoggingChannel]: selectLoggingChannel
        }
    },
    dmMethodMap: {},
    skipProgressMessageSelectMenus: new Set([
        SelectMenuNames.ServerSettings,
        SelectMenuNames.SelectLoggingChannel
    ])
};

/**
 * Display the settings main menu
 * @param interaction
 */
async function showSettingsSelectMenu(
    interaction: SelectMenuInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    const selectedOption = interaction.values[0];
    const callbackMenu = serverSettingsMainMenuOptions.find(
        option => option.optionData.value === selectedOption
    );
    if (!callbackMenu) {
        throw new Error(`Invalid option selected: ${selectedOption}`);
    }
    await interaction.update(callbackMenu.subMenu(server, interaction.channelId, false));
}

async function selectLoggingChannel(
    interaction: SelectMenuInteraction<'cached'>
): Promise<void> {
    const server = isServerInteraction(interaction);
    const channelId = interaction.values[0];
    const loggingChannel = server.guild.channels.cache.get(channelId ?? '');
    const callbackMenu = serverSettingsMainMenuOptions.find(
        option => option.optionData.value === 'logging-channel'
    );
    if (!loggingChannel || !isTextChannel(loggingChannel)) {
        throw ExpectedParseErrors.nonExistentTextChannel(channelId);
    }
    if (!callbackMenu) {
        throw new Error('Invalid option selected:');
    }
    await server.setLoggingChannel(loggingChannel);
    await interaction.update(callbackMenu.subMenu(server, interaction.channelId, false));
}

export { baseYabobSelectMenuMap };