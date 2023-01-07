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
    unparsableDateString: (sheetName:string) => new CommandParseError(`Hmmm...YABOB cannot parse the data stored in ${sheetName}. Is the data format altered?`),
    nonServerInteraction: (guildName?: string) =>
        guildName === undefined
            ? new CommandParseError(
                  'I can only accept server based interactions. Please use this interaction inside a server.'
              )
            : new CommandParseError(
                  'I can only accept server based interactions. ' +
                      `Are you sure ${guildName} has a initialized YABOB with the google sheets extension?`
              )
} as const;

export { ExpectedSheetErrors };
