import { GoogleSpreadsheet } from 'google-spreadsheet';
import { environment } from '../../environment/environment-manager.js';
import { red } from '../../utils/command-line-colors.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import {
    BaseInteractionExtension,
    IInteractionExtension
} from '../extension-interface.js';
import { googleSheetsCommands } from './google-sheet-constants/google-sheet-slash-commands.js';
import { googleSheetCommandMap } from './interaction-handling/command-handler.js';

class GoogleSheetInteractionExtension
    extends BaseInteractionExtension
    implements IInteractionExtension
{
    constructor() {
        super();
    }

    /**
     * Returns a new GoogleSheetLoggingExtension for the server with the given name
     * - Uses the google sheet id from the environment
     * @param guild
     * @throws ExtensionSetupError if
     * - the google sheet id is not set in the environment
     * - the google sheet id is invalid
     * - the google sheet is not accessible
     */
    override async initializationCheck(): Promise<void> {
        if (environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID.length === 0) {
            throw new ExtensionSetupError(
                'No Google Sheet ID or Google Cloud credentials found.'
            );
        }
        const googleSheet = new GoogleSpreadsheet(
            environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID
        );
        await googleSheet.useServiceAccountAuth(environment.googleCloudCredentials);
        await googleSheet.loadInfo().catch(() => {
            throw new ExtensionSetupError(
                red(
                    `Failed to load the default google sheet. Google sheets rejected our connection.`
                )
            );
        });
    }

    override slashCommandData = googleSheetsCommands;

    override commandMap = googleSheetCommandMap;
}

export { GoogleSheetInteractionExtension };
