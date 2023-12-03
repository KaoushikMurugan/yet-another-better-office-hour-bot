/** @module ExpectedErrors */

import { environment } from '../../../environment/environment-manager.js';
import { CommandParseError } from '../../../utils/error-types.js';

class AttendanceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AttendanceError';
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

class GoogleSheetConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GoogleSheetConnectionError';
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

const ExpectedSheetErrors = {
    unknownEntry: new AttendanceError(
        "Failed to update attendance. YABOB doesn't recognize this entry."
    ),
    recordedButCannotUpdate: new AttendanceError(
        'Failed to update attendance. ' +
            'The attendance sheet might have missing headers or does not allow this YABOB to make changes.\n' +
            "Don't worry, your hours are still being logged, " +
            'just not viewable on Google Sheets. ' +
            'Please contact @Bot Admin to manually update.'
    ),
    badGoogleSheetId: new GoogleSheetConnectionError(
        `YABOB cannot access this google sheet. Make sure you share the google sheet with this YABOB's email: \`${environment.googleCloudCredentials.client_email}\``
    ),
    noDataYet: (type: 'Help Session' | 'Attendance') =>
        new CommandParseError(
            `There are no rows in the ${type} sheet yet. Try running this command again after a ${type.toLowerCase()} entry has been written.`
        ),
    missingSheet: (type: 'Help Session' | 'Attendance') =>
        new GoogleSheetConnectionError(
            `${type} google worksheet is missing in the google sheet document. This is expected if your server has never had any office hour sessions.` +
                ' This can also happen if you changed your server name recently and have not hosted a office hour session yet.'
        ),
    unparsableNonNumericData: (sheetName: string, column: string) =>
        new CommandParseError(
            `Hmmm...YABOB cannot parse the data stored in ${sheetName} at column ${column}. Is the data format altered?`
        ),
    notInitialized: (guildName?: string) =>
        guildName === undefined
            ? new CommandParseError(
                  'I can only accept server based interactions. Please use this interaction inside a server.'
              )
            : new CommandParseError(
                  'I can only accept server based interactions. ' +
                      `Are you sure ${guildName} has a initialized YABOB with the google sheets extension?`
              ),
    noWriteAccess: new GoogleSheetConnectionError(
        'YABOB does not have write access to the google sheet for this server, please contact the server admins to get your help time recorded.'
    ),
    badNumericalValues: (sheetName: string, column?: string) =>
        new CommandParseError(
            `Some numbers in ${sheetName}${
                column ? ` at column ${column}` : ''
            } is not a positive integer. You can fix the values then run the command again.`
        )
} as const;

export { ExpectedSheetErrors };
