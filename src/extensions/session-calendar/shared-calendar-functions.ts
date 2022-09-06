import { calendar_v3 } from "googleapis";
import { CalendarConnectionError } from "./calendar-command-extension";
import { serverIdStateMap } from "./calendar-states";
import calendarConfig from '../extension-credentials/calendar-config.json';

// ViewModel for 1 tutor's upcoming session
type UpComingSessionViewModel = {
    start: Date;
    end: Date;
    rawSummary: string;
    displayName: string;
    eventQueue: string;
    discordId?: string;
};

/**
 * Fetches the calendar and build the embed view model
 * ----
 * @param queueName: the name to look for in the calendar event
*/
async function getUpComingTutoringEvents(
    serverId: string,
    queueName: string
): Promise<UpComingSessionViewModel[]> {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const calendarUrl = buildCalendarURL({
        calendarId: serverIdStateMap.get(serverId)?.calendarId ?? "",
        apiKey: calendarConfig.YABOB_GOOGLE_API_KEY,
        timeMin: new Date(),
        timeMax: nextWeek
    });
    const response = await fetch(calendarUrl);
    if (response.status !== 200) {
        return Promise.reject(new CalendarConnectionError(
            'Failed to connect to Google Calendar. ' +
            'The calendar might be deleted or set to private.'
        ));
    }
    const responseJSON = await response.json();
    const events = (responseJSON as calendar_v3.Schema$Events).items;
    if (!events || events.length === 0) {
        return [];
    }
    // Format: "StartDate - Summary"
    const definedEvents = events
        .filter(event => event.start?.dateTime && event.end?.dateTime)
        .map((event) => {
            // we already checked for dateTime existence
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const start = event.start!.dateTime!;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const end = event.end!.dateTime!;
            return composeViewModel(
                serverId,
                queueName,
                event.summary ?? '',
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

/**
 * Parses the summary string and builds the view model for the current queue
 * ----
 * @param summary string from getUpComingTutoringEvents
 * @param start start Date
 * @param end end Date
 * @returns undefined if any parsing failed, otherwise a complete view model
*/
function composeViewModel(
    serverId: string,
    queueName: string,
    summary: string,
    start: Date,
    end: Date,
): UpComingSessionViewModel | undefined {
    // Summary example: "Tutor Name - ECS 20, 36A, 36B, 122A, 122B"
    // words will be ["TutorName ", "ECS 20, 36A, 36B, 122A, 122B"]
    const words = summary.split('-');
    if (words.length !== 2) {
        return undefined;
    }

    const punctuations = /[,]/g;
    const tutorName = words[0]?.trim();
    const eventQueues = words[1]?.trim().split(', ')
        .map(eventQueue => eventQueue
            ?.replace(punctuations, '')
            .trim());
    // ["ECS", "20,", "36A,", "36B,", "122A,", "122B"]
    // ecsClasses?.shift(); // Remove the ECS

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
        rawSummary: summary,
        displayName: tutorName,
        discordId: serverIdStateMap
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
    UpComingSessionViewModel
};