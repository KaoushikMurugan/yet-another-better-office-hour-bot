/** @module ExpectedErrors */

import { CommandParseError } from '../../utils/error-types';

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
    nonServerInteraction: (guildName?: string) =>
        guildName === undefined
            ? new CommandParseError(
                  'I can only accept server based interactions. ' +
                      'Please use this interaction inside a server.'
              )
            : new CommandParseError(
                  'I can only accept server based interactions. ' +
                      `Are you sure ${guildName} has a initialized YABOB with the calendar xtension?`
              ),
    inaccessibleCalendar: new CalendarConnectionError(
        'Failed to connect to Google Calendar. ' +
            'The calendar might be deleted or set to private.'
    ),
    refreshTimedout: new CalendarConnectionError(
        'This calendar refresh timed out. Please try again later.'
    ),
    failedRequest: new CalendarConnectionError('Calendar request failed.'),
    nonAdminMakingCalendarStrForOthers: new CommandParseError(
        `Only Bot Admins have the permission to update calendar string for users that are not yourself. `
    )
} as const;

export { ExpectedCalendarErrors, CalendarConnectionError };
