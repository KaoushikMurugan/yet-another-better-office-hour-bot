import { SelectMenuInteraction } from 'discord.js';
import { serverSettingsMainMenuOptions } from '../attending-server/server-settings-menus.js';
import { isTextChannel } from '../utils/util-functions.js';
import { SelectMenuHandlerProps } from './handler-interface.js';
import { ExpectedParseErrors } from './interaction-constants/expected-interaction-errors.js';
import { SelectMenuNames } from './interaction-constants/interaction-names.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';

const baseYabobSelectMenuMap: SelectMenuHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [SelectMenuNames.ServerSettings]: showSettingsSubMenu,
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
 * Display the submenu of the selected option
 * @param interaction
 */
async function showSettingsSubMenu(
    interaction: SelectMenuInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const selectedOption = interaction.values[0];
    const callbackMenu = serverSettingsMainMenuOptions.find(
        option => option.optionData.value === selectedOption
    )?.menu;
    if (!callbackMenu) {
        throw new Error(`Invalid option selected: ${selectedOption}`);
    }
    await interaction.update(
        callbackMenu(server, interaction.channelId, false, undefined)
    );
}

async function selectLoggingChannel(
    interaction: SelectMenuInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
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
    await interaction.update(
        callbackMenu.menu(
            server,
            interaction.channelId,
            false,
            'Logging channel has been updated!'
        )
    );
}

export { baseYabobSelectMenuMap };
