import { GoogleSpreadsheet } from 'google-spreadsheet';
import { AttendingServerV2 } from '../../attending-server/base-attending-server.js';
import { Optional } from '../../utils/type-aliases.js';
import {
    GoogleSheetLoggingExtension,
    googleSheetsStates
} from './google-sheet-server-extension.js';
import { isServerInteraction } from '../../interaction-handling/shared-validations.js';
import { ExpectedSheetErrors } from './google-sheet-constants/expected-sheet-errors.js';
import { Interaction } from 'discord.js';

function getServerGoogleSheet(server: AttendingServerV2): Optional<GoogleSpreadsheet> {
    const ext = googleSheetsStates.get(server.guild.id);
    return ext?.googleSheet;
}

/**
 * Checks if the interaction came from
 * @param interaction
 */
function isServerGoogleSheetInteraction(
    interaction: Interaction<'cached'>
): [state: GoogleSheetLoggingExtension, server: AttendingServerV2] {
    const server = isServerInteraction(interaction);
    const state = googleSheetsStates.get(server.guild.id);
    if (!state) {
        throw ExpectedSheetErrors.nonServerInteraction(server.guild.name);
    }
    return [state, server];
}

export { getServerGoogleSheet, isServerGoogleSheetInteraction };
