import { ModalSubmitInteraction } from 'discord.js';
import { ModalSubmitHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { GoogleSheetModalNames } from '../google-sheet-constants/google-sheet-interaction-names.js';
import { AttendingServer } from '../../../attending-server/base-attending-server.js';
import { GoogleSheetExtensionState } from '../google-sheet-states.js';
import { GoogleSheetSuccessMessages } from '../google-sheet-constants/sheet-success-messages.js';
import { GoogleSheetSettingsConfigMenu } from '../google-sheet-constants/google-sheet-settings-menu.js';
import { environment } from '../../../environment/environment-manager.js';

const googleSheetModalMap: ModalSubmitHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [GoogleSheetModalNames.GoogleSheetSettingsModal]: interaction =>
                updateGoogleSheetSettings(interaction, false),
            [GoogleSheetModalNames.GoogleSheetSettingsModalMenuVersion]: interaction =>
                updateGoogleSheetSettings(interaction, true)
        }
    },
    dmMethodMap: {}
};

/**
 * Updates the google sheet settings
 * @param interaction
 * @param useMenu
 */
async function updateGoogleSheetSettings(
    interaction: ModalSubmitInteraction<'cached'>,
    useMenu: boolean
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const state = GoogleSheetExtensionState.get(interaction.guildId);
    const googleSheetID = interaction.fields.getTextInputValue('google_sheet_id');
    await state.setGoogleSheet(googleSheetID);

    // Enable tracking when new sheet is not default sheet
    if (googleSheetID !== environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID) {
        await server.setSheetTracking(true);
    }

    server.sendLogMessage(
        GoogleSheetSuccessMessages.updatedGoogleSheet(state.googleSheet.title)
    );

    if (useMenu && interaction.isFromMessage()) {
        await interaction.update(
            GoogleSheetSettingsConfigMenu(
                server,
                false,
                'Google Sheet settings have been saved!'
            )
        );
    } else {
        await interaction.reply({
            ...GoogleSheetSuccessMessages.updatedGoogleSheet(state.googleSheet.title),
            ephemeral: true
        });
    }
}

export { googleSheetModalMap };
