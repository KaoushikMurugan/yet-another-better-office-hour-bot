import { GoogleSpreadsheet } from 'google-spreadsheet';
import { ExpectedSheetErrors } from './google-sheet-constants/expected-sheet-errors.js';
import { environment } from '../../environment/environment-manager.js';
import { LOGGER } from '../../global-states.js';
import { JWT } from 'google-auth-library';

const GOOGLE_SHEET_LOGGER = LOGGER.child({ extension: 'Google Sheet' });

/**
 * Loads a google sheet object by sheet id
 * @param sheetId id found in the url
 */
async function loadSheetById(sheetId: string): Promise<GoogleSpreadsheet> {
    const googleSheet = new GoogleSpreadsheet(
        sheetId,
        new JWT({
            email: environment.googleCloudCredentials.client_email,
            key: environment.googleCloudCredentials.private_key,
            scopes: [
                // google sheets scope
                'https://www.googleapis.com/auth/spreadsheets',
                // scopes for checking permission
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.readonly'
            ]
        })
    );
    await googleSheet.loadInfo().catch(err => {
        GOOGLE_SHEET_LOGGER.error(err, `Bad google sheet id: ${sheetId}`);
        throw ExpectedSheetErrors.badGoogleSheetId;
    });
    return googleSheet;
}

export { loadSheetById, GOOGLE_SHEET_LOGGER };
