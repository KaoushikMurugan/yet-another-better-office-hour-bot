import { calendar_v3 } from 'googleapis';
import { serverIdCalendarStateMap } from './calendar-states';
import axios from 'axios';
import environment from '../../environment/environment-manager';
import { Optional } from '../../utils/type-aliases';

// ViewModel for 1 tutor's upcoming session
type UpComingSessionViewModel = {
    start: Date;
    end: Date;
    eventSummary: string;
    displayName: string;
    eventQueue: string; // the queue that this event corrsponds to
    discordId?: string;
    location?: string;
};

class CalendarConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CalendarConnectionError';
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

/**
 * Fetches the calendar and build the embed view model
 * @param serverId guild.id for calendarState.get()
 * @param queueName the name to look for in the calendar event
 */
async function getUpComingTutoringEvents(
    serverId: string,
    queueName: string
): Promise<UpComingSessionViewModel[]> {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const calendarUrl = buildCalendarURL({
        // defaults to empty to let the api call reject, then prompt user to fix the id
        calendarId: serverIdCalendarStateMap.get(serverId)?.calendarId ?? '',
        apiKey: environment.sessionCalendar.YABOB_GOOGLE_API_KEY,
        timeMin: new Date(),
        timeMax: nextWeek,
        maxResults: 100
    });
    const response = await axios({
        url: calendarUrl,
        timeout: 5000,
        method: 'GET'
    }).catch(() => {
        throw new CalendarConnectionError(
            'This calendar refresh timed out. Please try again later.'
        );
    });
    if (response.status !== 200) {
        throw new CalendarConnectionError(
            'Failed to connect to Google Calendar. ' +
                'The calendar might be deleted or set to private.'
        );
    }
    const responseJSON = await response.data;
    const events = (responseJSON as calendar_v3.Schema$Events)?.items;
    if (!events || events.length === 0) {
        return [];
    }
    const definedViewModels = events
        .filter(
            event => event.start?.dateTime && event.end?.dateTime && event.description
        )
        .map(cleanEvent => {
            // we already checked for all 4 values' existence
            const [start, end, description] = [
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                cleanEvent.start!.dateTime!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                cleanEvent.end!.dateTime!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                cleanEvent.description!
            ];
            const parsableCalendarString = description
                .substring(
                    description.indexOf('YABOB_START') + 'YABOB_START'.length,
                    description.indexOf('YABOB_END')
                )
                .trimStart()
                .trimEnd();
            const viewModel = composeViewModel(
                serverId,
                queueName,
                cleanEvent.summary ?? '',
                parsableCalendarString ?? '',
                new Date(start),
                new Date(end),
                cleanEvent.location ?? undefined
            );
            // trim to avoid overflow
            if (viewModel?.location !== undefined) {
                viewModel.location =
                    viewModel.location?.length > 25
                        ? viewModel.location?.substring(0, 25) + '...'
                        : viewModel.location;
            }
            return viewModel;
        })
        .filter(viewModel => viewModel !== undefined);
    // already filtered
    return definedViewModels as UpComingSessionViewModel[];
}

async function checkCalendarConnection(newCalendarId: string): Promise<string> {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const calendarUrl = buildCalendarURL({
        calendarId: newCalendarId,
        timeMin: new Date(),
        timeMax: nextWeek,
        apiKey: environment.sessionCalendar.YABOB_GOOGLE_API_KEY,
        maxResults: 2
    });
    const response = await axios({
        url: calendarUrl,
        timeout: 5000,
        method: 'GET'
    }).catch(() => {
        throw new CalendarConnectionError(
            'This calendar refresh timed out. Please try again later.'
        );
    });
    if (response.status !== 200) {
        throw new CalendarConnectionError('Calendar request failed.');
    }
    const responseJSON = await response.data;
    return (responseJSON as calendar_v3.Schema$Events).summary ?? '';
}

/**
 * Parses the summary string and builds the view model for the current queue
 * @param rawSummary unmodified calendar event summary
 * @param parsingString string found the the calendar event description
 * @param start start date of 1 session
 * @param end end date of 1 session
 * @param location where the help session will happen
 * @returns undefined if any parsing failed, otherwise a complete view model
 */
function composeViewModel(
    serverId: string,
    queueName: string,
    rawSummary: string,
    parsingString: string,
    start: Date,
    end: Date,
    location?: string
): Optional<UpComingSessionViewModel> {
    // parsingString example: 'Tutor Name - ECS 20, ECS 36A, ECS 36B, ECS 122A, ECS 122B'
    // words will be ['TutorName ', ' ECS 20, ECS 36A, ECS 36B, ECS 122A, ECS 122B']
    const words = parsingString.split('-');
    if (words.length !== 2) {
        return undefined;
    }
    const punctuations = /[,]/g;
    const tutorName = words[0]?.trim();
    const eventQueueNames = words[1]
        ?.trim()
        .split(', ')
        .map(eventQueue => eventQueue?.replace(punctuations, '').trim());
    // eventQueues will be:
    // ['ECS 20', 'ECS 36A', 'ECS 36B', 'ECS 122A', 'ECS 122B']
    if (eventQueueNames?.length === 0 || tutorName === undefined) {
        return undefined;
    }
    const targetQueue = eventQueueNames?.find(name => queueName === name);
    if (targetQueue === undefined) {
        return undefined;
    }
    return {
        start: start,
        end: end,
        eventQueue: targetQueue,
        eventSummary: rawSummary,
        displayName: tutorName,
        discordId: serverIdCalendarStateMap
            .get(serverId)
            ?.displayNameDiscordIdMap.get(tutorName),
        location: location
    };
}

/**
 * Builds the calendar URL
 * @param args.calendar_id id to the PUBLIC calendar
 * @param args.apiKey apiKey found in calendar-config.ts
 * @param args.timeMin the start of the date range
 * @param args.timeMax the end of the date range
 */
function buildCalendarURL(args: {
    calendarId: string;
    apiKey: string;
    timeMin: Date;
    timeMax: Date;
    maxResults: number;
}): string {
    return (
        `https://www.googleapis.com/calendar/v3/calendars/${args.calendarId}/events?` +
        `&key=${args.apiKey}` +
        `&timeMax=${args.timeMax.toISOString()}` +
        `&timeMin=${args.timeMin.toISOString()}` +
        `&maxResults=${args.maxResults.toString()}` +
        `&orderBy=startTime` +
        `&singleEvents=true`
    );
}

/**
 * Creates a url from calendar id that takes the user to the public embed
 */
function restorePublicEmbedURL(calendarId: string): string {
    return `https://calendar.google.com/calendar/embed?src=${calendarId}&ctz=America%2FLos_Angeles&mode=WEEK`;
}

export {
    getUpComingTutoringEvents,
    composeViewModel,
    buildCalendarURL,
    UpComingSessionViewModel,
    checkCalendarConnection,
    CalendarConnectionError,
    restorePublicEmbedURL
};
