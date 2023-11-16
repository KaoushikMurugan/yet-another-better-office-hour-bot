import { environment } from '../../environment/environment-manager.js';
import { yellow } from '../../utils/command-line-colors.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import {
    BaseInteractionExtension,
    InteractionExtension
} from '../extension-interface.js';
import {
    googleSheetAdminHelpMessages,
    googleSheetStaffHelpMessages
} from './google-sheet-constants/GoogleSheetCommands.js';
import { googleSheetSettingsMainMenuOptions } from './google-sheet-constants/google-sheet-settings-menu.js';
import { googleSheetsCommands } from './google-sheet-constants/google-sheet-slash-commands.js';
import { googleSheetButtonMap } from './interaction-handling/button-handler.js';
import { googleSheetCommandMap } from './interaction-handling/command-handler.js';
import { googleSheetModalMap } from './interaction-handling/modal-handler.js';
import { GOOGLE_SHEET_LOGGER, loadSheetById } from './shared-sheet-functions.js';

class GoogleSheetInteractionExtension
    extends BaseInteractionExtension
    implements InteractionExtension
{
    constructor() {
        super();
    }

    override helpMessages = {
        botAdmin: googleSheetAdminHelpMessages,
        staff: googleSheetStaffHelpMessages,
        student: []
    };

    override buttonMap = googleSheetButtonMap;

    override modalMap = googleSheetModalMap;

    override slashCommandData = googleSheetsCommands;

    override commandMap = googleSheetCommandMap;

    override settingsMainMenuOptions = googleSheetSettingsMainMenuOptions;

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
        GOOGLE_SHEET_LOGGER.info(
            `Using ${yellow(googleSheet.title)} as the default google sheet.`
        );
    }
}

export { GoogleSheetInteractionExtension };
