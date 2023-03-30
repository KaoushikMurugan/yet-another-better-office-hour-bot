import { ButtonInteraction } from 'discord.js';
import { AttendingServerV2 } from '../../../attending-server/base-attending-server.js';
import { environment } from '../../../environment/environment-manager.js';
import { ButtonHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { GoogleSheetButtonNames } from '../google-sheet-constants/google-sheet-interaction-names.js';
import { GoogleSheetExtensionState } from '../google-sheet-states.js';
import { googleSheetSettingsModal } from '../google-sheet-constants/google-sheet-modal-objects.js';
import { GoogleSheetSettingsConfigMenu } from '../google-sheet-constants/google-sheet-settings-menu.js';
import { GoogleSheetSuccessMessages } from '../google-sheet-constants/sheet-success-messages.js';

const googleSheetButtonMap: ButtonHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [GoogleSheetButtonNames.ResetGoogleSheetSettings]: resetGoogleSheetSettings,
            [GoogleSheetButtonNames.ShowGoogleSheetSettingsModal]:
                showGoogleSheetSettingsModal
        }
    },
    dmMethodMap: {},
    skipProgressMessageButtons: new Set([
        GoogleSheetButtonNames.ResetGoogleSheetSettings,
        GoogleSheetButtonNames.ShowGoogleSheetSettingsModal
    ])
};

/**
 * Resets the google sheets settings to the default specified in the environment
 * @param interaction
 */
async function resetGoogleSheetSettings(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const state = GoogleSheetExtensionState.get(interaction.guildId);
    await Promise.all([
        state.setGoogleSheet(environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID),
        server.sendLogMessage(GoogleSheetSuccessMessages.updatedGoogleSheet(state.googleSheetURL))
    ]);
    await interaction.update(
        GoogleSheetSettingsConfigMenu(
            server,
            interaction.channelId,
            false,
            'Successfully reset all calendar settings.'
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
    const server = AttendingServerV2.get(interaction.guildId);
    await interaction.showModal(googleSheetSettingsModal(server.guild.id, true));
}

export { googleSheetButtonMap };
