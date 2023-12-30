import {
    APIEmbedField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';
import { SettingsSwitcher } from '../../../attending-server/server-settings-menus.js';
import { environment } from '../../../environment/environment-manager.js';
import { buildComponent } from '../../../utils/component-id-factory.js';
import { EmbedColor } from '../../../utils/embed-helper.js';
import { SettingsMenuOption, YabobEmbed } from '../../../utils/type-aliases.js';
import { FrozenServer } from '../../extension-utils.js';
import { GoogleSheetExtensionState } from '../google-sheet-states.js';
import { GoogleSheetButtonNames } from './google-sheet-interaction-names.js';

/**
 * Options for the server settings main menu
 * @see {@link serverSettingsMainMenuOptions}
 */
const googleSheetSettingsMainMenuOptions: SettingsMenuOption[] = [
    {
        selectMenuOptionData: {
            emoji: '📊',
            label: 'Google Sheet Logging Settings',
            description: 'Configure the Google Sheet Logging settings',
            value: 'google-sheet-settings'
        },
        useInSettingsCommand: true,
        menu: GoogleSheetSettingsConfigMenu
    }
];

/** Compose the Google Sheet Logging settings settings menu */
function GoogleSheetSettingsConfigMenu(
    server: FrozenServer,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const state = GoogleSheetExtensionState.allStates.get(server.guild.id);

    if (!state) {
        throw new Error('Google Sheet Logging state for this server was not found');
    }

    const currentSheet: APIEmbedField = {
        name: 'Current Google Sheet',
        value: ''
    };

    if (server.sheetTracking) {
        currentSheet.value = `[Google Sheet Link](${state.googleSheetURL})\nSheet Name: ${state.googleSheet.title}\nTracking enabled`;
    } else {
        currentSheet.value =
            'Tracking disabled. Enable tracking or set a new Google sheet to track hours.';
    }

    const embed = new EmbedBuilder()
        .setTitle(`📊 Google Sheet Logging Configuration for ${server.guild.name} 📊`)
        .setColor(EmbedColor.Aqua)
        .setFields(
            {
                name: 'Description',
                value: `This setting controls which google sheet this server will be used for logging.\n- Make sure to share the google sheet with this YABOB's email: \`${environment.googleCloudCredentials.client_email}\``
            },
            {
                name: 'Documentation',
                value: `[Learn more about Google Sheet Logging settings here.](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Configure-YABOB-Settings-For-Your-Server#google-sheet-settings)`
            },
            currentSheet
        );

    if (updateMessage.length > 0) {
        embed.setFooter({ text: `✅ ${updateMessage}` });
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            GoogleSheetButtonNames.UpdateSheetTrackingStatus,
            server.guild.id
        ])
            .setEmoji(`${!server.sheetTracking ? '✔️' : '✖️'}`)
            .setLabel(
                `${!server.sheetTracking ? 'Enable' : 'Disable'} Google Sheet Tracking`
            )
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
                state.googleSheet.spreadsheetId ===
                    environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID
            ),
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            GoogleSheetButtonNames.ShowGoogleSheetSettingsModal,
            server.guild.id
        ])
            .setEmoji('📊')
            .setLabel('Change Google Sheet')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            GoogleSheetButtonNames.ResetGoogleSheetSettings,
            server.guild.id
        ])
            .setEmoji('🔗')
            .setLabel('Reset Google Sheet')
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [buttons, SettingsSwitcher(GoogleSheetSettingsConfigMenu)]
    };
}

export { GoogleSheetSettingsConfigMenu, googleSheetSettingsMainMenuOptions };
