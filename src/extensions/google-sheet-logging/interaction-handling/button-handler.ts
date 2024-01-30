import { ButtonInteraction } from 'discord.js';
import { AttendingServer } from '../../../attending-server/base-attending-server.js';
import { environment } from '../../../environment/environment-manager.js';
import { ButtonHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { GoogleSheetButtonNames } from '../google-sheet-constants/google-sheet-interaction-names.js';
import { googleSheetSettingsModal } from '../google-sheet-constants/google-sheet-modal-objects.js';
import { GoogleSheetSettingsConfigMenu } from '../google-sheet-constants/google-sheet-settings-menu.js';
import { GoogleSheetSuccessMessages } from '../google-sheet-constants/sheet-success-messages.js';
import { GoogleSheetExtensionState } from '../google-sheet-states.js';

const googleSheetButtonMap: ButtonHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [GoogleSheetButtonNames.UpdateSheetTrackingStatus]: updateSheetTrackingStatus,
            [GoogleSheetButtonNames.ResetGoogleSheetSettings]: resetGoogleSheetSettings,
            [GoogleSheetButtonNames.ShowGoogleSheetSettingsModal]:
                showGoogleSheetSettingsModal
        }
    },
    dmMethodMap: {},
    skipProgressMessageButtons: new Set([
        GoogleSheetButtonNames.UpdateSheetTrackingStatus,
        GoogleSheetButtonNames.ResetGoogleSheetSettings,
        GoogleSheetButtonNames.ShowGoogleSheetSettingsModal
    ])
};

/**
 * Updates sheet tracking setting
 * @param interaction
 */
async function updateSheetTrackingStatus(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const newTrackingStatus = !server.sheetTracking;

    server.setSheetTracking(newTrackingStatus);
    server.sendLogMessage(
        GoogleSheetSuccessMessages.updatedSheetTracking(newTrackingStatus)
    );

    await interaction.update(
        GoogleSheetSettingsConfigMenu(
            server,
            false,
            `Successfully ${
                newTrackingStatus ? 'enabled' : 'disabled'
            } google sheet tracking.`
        )
    );
}

/**
 * Resets the google sheets settings to the default specified in the environment
 * @param interaction
 */
async function resetGoogleSheetSettings(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const state = GoogleSheetExtensionState.get(interaction.guildId);

    await state.setGoogleSheet(environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID);
   
    server.setSheetTracking(false);
    server.sendLogMessage(
        GoogleSheetSuccessMessages.updatedGoogleSheet(state.googleSheetURL)
    );

    await interaction.update(
        GoogleSheetSettingsConfigMenu(
            server,
            false,
            'Successfully reset google sheet settings.'
        )
    );
}

/**
 * Shows the modal for the google sheet settings
 * @param interaction
 */
async function showGoogleSheetSettingsModal(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    await interaction.showModal(googleSheetSettingsModal(server.guild.id, true));
}

export { googleSheetButtonMap };
