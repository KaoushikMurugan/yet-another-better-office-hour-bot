import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { EmbedColor } from '../../../utils/embed-helper.js';
import { SettingsMenuOption, YabobEmbed } from '../../../utils/type-aliases.js';
import { FrozenServer } from '../../extension-utils.js';
import { GoogleSheetExtensionState } from '../google-sheet-states.js';
import { SettingsSwitcher } from '../../../attending-server/server-settings-menus.js';
import { buildComponent } from '../../../utils/component-id-factory.js';
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
    channelId: string,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const state = GoogleSheetExtensionState.allStates.get(server.guild.id);

    if (!state) {
        throw new Error('Google Sheet Logging state for this server was not found');
    }

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
                value: `[Learn more about Google Sheet Logging settings here.](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Configure-YABOB-Settings-For-Your-Server#google-sheet-settings)`
            },
            {
                name: 'Current Google Sheet',
                value: `[Google Sheet](${state.googleSheetURL})`
            }
        );

    if (updateMessage.length > 0) {
        embed.setFooter({ text: `✅ ${updateMessage}` });
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            GoogleSheetButtonNames.ShowGoogleSheetSettingsModal,
            server.guild.id,
            channelId
        ])
            .setEmoji('📊')
            .setLabel('Change Google Sheet')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            GoogleSheetButtonNames.ResetGoogleSheetSettings,
            server.guild.id,
            channelId
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

export { googleSheetSettingsMainMenuOptions, GoogleSheetSettingsConfigMenu };
