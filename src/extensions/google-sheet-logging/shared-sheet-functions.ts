import { GoogleSpreadsheet } from 'google-spreadsheet';
import { ExpectedSheetErrors } from './google-sheet-constants/expected-sheet-errors.js';
import { environment } from '../../environment/environment-manager.js';

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

export { loadSheetById };
