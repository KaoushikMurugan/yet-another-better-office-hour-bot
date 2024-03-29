/** @module ExpectedErrors */

import { CommandParseError, ServerError } from '../../../utils/error-types.js';

class CalendarConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CalendarConnectionError';
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

const ExpectedCalendarErrors = {
    badId: {
        defaultId: new CalendarConnectionError(`The default calendar id is not valid.`),
        newId: new CalendarConnectionError('This new calendar ID is not valid.')
    },
    noState: (guildName?: string) =>
        guildName
            ? new ServerError(
                  `Are you sure ${guildName} has a initialized YABOB with the calendar extension?`
              )
            : new ServerError("The state object doesn't exist"),
    notInitialized: (guildName?: string) =>
        guildName === undefined
            ? new CommandParseError(
                  'I can only accept server based interactions. Please use this interaction inside a server.'
              )
            : new CommandParseError(
                  'I can only accept server based interactions. ' +
                      `Are you sure ${guildName} has a initialized YABOB with the calendar extension?`
              ),
    inaccessibleCalendar: new CalendarConnectionError(
        'Failed to connect to Google Calendar. The calendar might have been deleted or set to private.'
    ),
    refreshTimedOut: new CalendarConnectionError(
        'This calendar refresh timed out. Please try again later.'
    ),
    failedRequest: new CalendarConnectionError('Calendar request failed.'),
    nonAdminMakingCalendarStringForOthers: new CommandParseError(
        'Only Bot Admins have the permission to update calendar strings for users that are not yourself.'
    ),
    badPublicEmbedUrl: new CommandParseError(
        'Please provide a valid and complete URL. (it should start with https://...)'
    )
} as const;

export { ExpectedCalendarErrors, CalendarConnectionError };
