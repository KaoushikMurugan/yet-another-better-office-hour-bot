import { calendar_v3 } from "googleapis";
import { serverIdCalendarStateMap } from "./calendar-states";
import axios from 'axios';
import calendarConfig from '../extension-credentials/calendar-config.json';

// ViewModel for 1 tutor's upcoming session
type UpComingSessionViewModel = {
    start: Date;
    end: Date;
    eventSummary: string;
    displayName: string;
    eventQueue: string;
    discordId?: string;
};

class CalendarConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CalendarConnectionError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

/**
 * Fetches the calendar and build the embed view model
 * ----
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
        apiKey: calendarConfig.YABOB_GOOGLE_API_KEY,
        timeMin: new Date(),
        timeMax: nextWeek
    });
    const response = await axios.get(calendarUrl);
    if (response.status !== 200) {
        return Promise.reject(new CalendarConnectionError(
            'Failed to connect to Google Calendar. ' +
            'The calendar might be deleted or set to private.'
        ));
    }
    const responseJSON = await response.data;
    const events = (responseJSON as calendar_v3.Schema$Events).items;
    if (!events || events.length === 0) {
        return [];
    }
    const definedEvents = events
        .filter(event => event.start?.dateTime && event.end?.dateTime && event.description)
        .map((event) => {
            // we already checked for all 3 values' existence
            const [start, end, description] = [
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                event.start!.dateTime!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                event.end!.dateTime!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                event.description!
            ];

            const parsableCalendarString = description.substring(
                description.indexOf('YABOB_START') + 'YABOB_START'.length,
                description.indexOf('YABOB_END')
            ).trimStart().trimEnd();

            return composeViewModel(
                serverId,
                queueName,
                event.summary ?? '',
                parsableCalendarString ?? '',
                new Date(start),
                new Date(end),
            );
        })
        .filter(s => s !== undefined);
    if (definedEvents.length === 0) {
        return [];
    }
    return definedEvents as UpComingSessionViewModel[];
}

async function checkCalendarConnection(
    newCalendarId: string
): Promise<string> {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const calendarUrl = buildCalendarURL({
        calendarId: newCalendarId,
        timeMin: new Date(),
        timeMax: nextWeek,
        apiKey: calendarConfig.YABOB_GOOGLE_API_KEY
    });
    const response = await axios.get(calendarUrl);
    if (response.status !== 200) {
        return Promise.reject('Calendar request failed.');
    }
    const responseJSON = await response.data;
    return (responseJSON as calendar_v3.Schema$Events).summary ?? '';
}

/**
 * Parses the summary string and builds the view model for the current queue
 * ----
 * @param rawSummary unmodified calendar event summary
 * @param parsingString string found the the calendar event description
 * @param start start Date
 * @param end end Date
 * @returns undefined if any parsing failed, otherwise a complete view model
*/
function composeViewModel(
    serverId: string,
    queueName: string,
    rawSummary: string,
    parsingString: string,
    start: Date,
    end: Date,
): UpComingSessionViewModel | undefined {
    // parsingString example: "Tutor Name - ECS 20, ECS 36A, ECS 36B, ECS 122A, ECS 122B"
    // words will be ["TutorName ", " ECS 20, ECS 36A, ECS 36B, ECS 122A, ECS 122B"]
    const words = parsingString.split('-');
    if (words.length !== 2) {
        return undefined;
    }
    const punctuations = /[,]/g;
    const tutorName = words[0]?.trim();
    const eventQueues = words[1]?.trim().split(', ')
        .map(eventQueue => eventQueue
            ?.replace(punctuations, '')
            .trim());
    // eventQueues will be:
    // ["ECS 20", "ECS 36A", "ECS 36B", "ECS 122A", "ECS 122B"]
    if (eventQueues?.length === 0 || tutorName === undefined) {
        return undefined;
    }
    const targetQueue = eventQueues?.find(eventQueue => queueName === eventQueue);
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
            ?.calendarNameDiscordIdMap
            .get(tutorName)
    };
}

/**
 * Builds the calendar URL
 * ----
 * @param args.calendar_id id to the PUBLIC calendar
 * @param args.apiKey apiKey found in calendar-config.ts
 * @param args.timeMin the start of the date range
 * @param args.timeMax the end of the date range
*/
function buildCalendarURL(args: {
    calendarId: string,
    apiKey: string,
    timeMin: Date,
    timeMax: Date,
}): string {
    return `https://www.googleapis.com/calendar/v3/calendars/${args.calendarId}/events?`
        + `&key=${args.apiKey}`
        + `&timeMax=${args.timeMax.toISOString()}`
        + `&timeMin=${args.timeMin.toISOString()}`
        + `&singleEvents=true`;
}

export {
    getUpComingTutoringEvents,
    composeViewModel,
    buildCalendarURL,
    UpComingSessionViewModel,
    checkCalendarConnection,
    CalendarConnectionError
};