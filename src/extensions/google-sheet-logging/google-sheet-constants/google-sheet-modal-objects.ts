import {
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    Snowflake,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { buildComponent } from '../../../utils/component-id-factory.js';
import { GoogleSheetExtensionState } from '../google-sheet-states.js';
import { GoogleSheetModalNames } from './google-sheet-interaction-names.js';
import { environment } from '../../../environment/environment-manager.js';

/**
 * Sets the Google Sheet URL for the server
 * @param serverId
 * @param useMenu if true, then modal submit returns the menu embed, else returns the success embed
 * @returns
 */
function googleSheetSettingsModal(serverId: Snowflake, useMenu = false): ModalBuilder {
    const state = GoogleSheetExtensionState.allStates.get(serverId);
    const modal = buildComponent(new ModalBuilder(), [
        'other',
        useMenu
            ? GoogleSheetModalNames.GoogleSheetSettingsModalMenuVersion
            : GoogleSheetModalNames.GoogleSheetSettingsModal,
        serverId
    ])
        .setTitle('Google Sheet Logging Settings')
        .setComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('google_sheet_id')
                    .setLabel('Google Sheet ID')
                    .setPlaceholder('Enter Google Sheet ID')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setValue(
                        state?.googleSheet.spreadsheetId !==
                            environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID
                            ? state?.googleSheet.spreadsheetId ?? ''
                            : ''
                    )
            )
        );
    return modal;
}

export { googleSheetSettingsModal };
