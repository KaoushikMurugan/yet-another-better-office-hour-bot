import { GoogleSpreadsheet } from 'google-spreadsheet';
import { AttendingServerV2 } from '../../attending-server/base-attending-server.js';
import { Optional } from '../../utils/type-aliases.js';
import { ExpectedSheetErrors } from './google-sheet-constants/expected-sheet-errors.js';
import { Interaction } from 'discord.js';
import { environment } from '../../environment/environment-manager.js';
import { GoogleSheetExtensionState } from './google-sheet-states.js';

function getServerGoogleSheet(server: AttendingServerV2): Optional<GoogleSpreadsheet> {
    return GoogleSheetExtensionState.allStates.get(server.guild.id)?.googleSheet;
}

/**
 * Checks if the interaction came from
 * @param interaction
 */
function isServerGoogleSheetInteraction(
    interaction: Interaction<'cached'>
): [state: GoogleSheetExtensionState, server: AttendingServerV2] {
    const server = AttendingServerV2.get(interaction.guildId);
    const state = GoogleSheetExtensionState.allStates.get(server.guild.id);
    if (!state) {
        throw ExpectedSheetErrors.nonServerInteraction(server.guild.name);
    }
    return [state, server];
}

/**
 * Loads a google sheet object by sheet id
 * @param sheetId id found in the url
 */
async function loadSheetById(sheetId: string): Promise<GoogleSpreadsheet> {
    const googleSheet = new GoogleSpreadsheet(sheetId);
    await googleSheet.useServiceAccountAuth(environment.googleCloudCredentials);
    await googleSheet.loadInfo().catch(() => {
        throw ExpectedSheetErrors.badGoogleSheetId;
    });
    return googleSheet;
}

export { getServerGoogleSheet, isServerGoogleSheetInteraction, loadSheetById };
