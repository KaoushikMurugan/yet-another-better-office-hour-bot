import { environment } from '../../environment/environment-manager.js';
import { blue, yellow } from '../../utils/command-line-colors.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import {
    BaseInteractionExtension,
    IInteractionExtension
} from '../extension-interface.js';
import { googleSheetsCommands } from './google-sheet-constants/google-sheet-slash-commands.js';
import { googleSheetCommandMap } from './interaction-handling/command-handler.js';
import { loadSheetById } from './shared-sheet-functions.js';

class GoogleSheetInteractionExtension
    extends BaseInteractionExtension
    implements IInteractionExtension
{
    constructor() {
        super();
    }

    /**
     * Checks if the default google sheet is accessible
     * @param guild
     * @throws ExtensionSetupError if
     * - the google sheet id is not set in the environment
     * - the google sheet id is invalid
     * - the google sheet is not accessible
     */
    override async initializationCheck(): Promise<void> {
        if (
            environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID.length === 0 ||
            environment.googleCloudCredentials.client_email.length === 0 ||
            environment.googleCloudCredentials.private_key.length === 0
        ) {
            throw new ExtensionSetupError(
                'No default Google Sheet ID or Google Cloud credentials found.'
            );
        }
        const googleSheet = await loadSheetById(
            environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID
        );
        console.log(
            `[${blue('Google Sheet Logging')}] Using ${yellow(
                googleSheet.title
            )} as the default google sheet.`
        );
    }

    override slashCommandData = googleSheetsCommands;

    override commandMap = googleSheetCommandMap;
}

export { GoogleSheetInteractionExtension };
