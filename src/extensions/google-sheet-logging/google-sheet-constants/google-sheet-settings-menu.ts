import { EmbedBuilder } from 'discord.js';
import { EmbedColor } from '../../../utils/embed-helper.js';
import { SettingsMenuOption, YabobEmbed } from '../../../utils/type-aliases.js';
import { FrozenServer } from '../../extension-utils.js';
import { GoogleSheetExtensionState } from '../google-sheet-states.js';
import { mainMenuRow } from '../../../attending-server/server-settings-menus.js';

/**
 * Options for the server settings main menu
 * @see {@link serverSettingsMainMenuOptions}
 */
const googleSheetSettingsMainMenuOptions: SettingsMenuOption[] = [
    {
        optionData: {
            emoji: '📊',
            label: 'Google Sheet Logging Settings',
            description: 'Configure the Google Sheet Logging settings',
            value: 'google-sheet-settings'
        },
        subMenu: GoogleSheetSettingsConfigMenu
    }
];

/** Compose the Google Sheet Logging settings settings menu */
function GoogleSheetSettingsConfigMenu(
    server: FrozenServer,
    channelId: string,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const state = GoogleSheetExtensionState.allStates.get(server.guild.id);
    if (!state) {
        throw new Error('Google Sheet Logging state for this server was not found');
    }

    const setGoogleSheetCommandID = server.guild.commands.cache.find(
        command => command.name === 'set_google_sheet'
    )?.id;

    const embed = new EmbedBuilder()
        .setTitle(`📊 Google Sheet Logging Configuration for ${server.guild.name} 📊`)
        .setColor(EmbedColor.Aqua)
        .setFields(
            {
                name: 'Description',
                value: 'This setting controls which Google Sheet this server will be used for logging.'
            },
            {
                name: 'Documentation',
                value: `[Learn more about Google Sheet Logging settings here.]()` //TODO: Add link to documentation
            },
            {
                name: 'Current Google Sheet',
                value:
                    `[Google Sheet](${state}) \n ` +
                    `To change the Google Sheet, please use the ${
                        setGoogleSheetCommandID
                            ? `</set_google_sheet:${setGoogleSheetCommandID}>`
                            : '`/set_google_sheet`'
                    } command.`
            }
        );
    return {
        embeds: [embed],
        components: [mainMenuRow]
    };
}

export { googleSheetSettingsMainMenuOptions, GoogleSheetSettingsConfigMenu };
