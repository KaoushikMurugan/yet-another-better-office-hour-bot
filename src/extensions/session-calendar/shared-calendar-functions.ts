/** @module SessionCalendar */
/**
 * @packageDocumentation
 * This file contains the common validation & util functions used by the calendar extension
 */
import type { calendar_v3 } from 'googleapis/build/src/apis/calendar';
import { CalendarExtensionState } from './calendar-states.js';
import axios from 'axios';
import { environment } from '../../environment/environment-manager.js';
import { GuildMemberId } from '../../utils/type-aliases.js';
import { ExpectedCalendarErrors } from './calendar-constants/expected-calendar-errors.js';
import { Snowflake } from 'discord.js';
import { z } from 'zod';
import { LOGGER } from '../../global-states.js';

/**
 * ViewModel for 1 tutor's upcoming session
 */
type UpcomingSessionViewModel = {
    /**
     * start time
     */
    start: Date;
    /**
     * end time
     */
    end: Date;
    /**
     * raw summary of the event, found in the title
     */
    eventSummary: string;
    /**
     * Display name of the tutor
     */
    displayName: string;
    /**
     * Name of the queue that this event corresponds to
     */
    queueName: string;
    /**
     * Discord snowflake of the helper
     */
    discordId?: string;
    /**
     * Location string found in the event, will be truncated to 25 characters
     */
    location?: string;
};

/**
 * Backup data model of calendar extension states
 */
interface CalendarConfigBackup {
    calendarId: string;
    calendarNameDiscordIdMap: { [calendarName: string]: GuildMemberId };
    publicCalendarEmbedUrl: string;
}

/**
 * Validation schema for data coming from the google api
 */
const calendarDataSchema = z.object({
    start: z.object({
        dateTime: z.string()
    }),
    end: z.object({
        dateTime: z.string()
    }),
    description: z.string()
});

const CALENDAR_LOGGER = LOGGER.child({ extension: 'Google Calendar' });

/**
 * Attempts to connect to the google calendar
 * @param newCalendarId id of the new calendar
 * @returns title of the calendar
 * @throws ExpectedCalendarErrors if
 * - API request fails
 * - API request times out
 */
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
    const response = await axios
        .get(calendarUrl, {
            timeout: 5000, // 5 second timeout
            method: 'GET'
        })
        .catch(() => {
            throw ExpectedCalendarErrors.refreshTimedOut;
        });
    if (response.status !== 200) {
        throw ExpectedCalendarErrors.failedRequest;
    }
    const responseJSON = await response.data;
    // it's just checking for connection
    // so it's not really worth it to pass through the schema checker
    return (responseJSON as calendar_v3.Schema$Events).summary ?? '';
}

/**
 * Transforms a upcoming session view model to this format:
 * ```plaintext
 * TutorName ┈ TutorName - 20, 36AB
 * Start: in 13 hours ┈ End: in 15 hours ┈ Location: Virtual
 * ```
 * @param viewModel
 * @returns the formatted string
 */
function transformViewModelToString(viewModel: UpcomingSessionViewModel): string {
    const spacer = '\u3000'; // ideographic space character, extra wide
    return (
        `**${
            viewModel.discordId ? `<@${viewModel.discordId}>` : viewModel.displayName
        }**${spacer}**${viewModel.eventSummary}**\n` +
        `Start: <t:${viewModel.start.getTime().toString().slice(0, -3)}:R>${spacer}` +
        `End: <t:${viewModel.end.getTime().toString().slice(0, -3)}:R>` +
        `${viewModel.location ? `${spacer}Location: ${viewModel.location}` : ''}`
    );
}
/**
 * Builds the body message of the upcoming sessions embed
 * @param viewModels models from {@link fetchUpcomingSessions}
 * @param title the queue name or the guild name
 * @param lastUpdatedTimeStamp when was the last time that the view models are updated
 * @param returnCount the MAXIMUM number of events to render
 * - if the value is 'max', show as many sessions as possible
 * @returns string that goes into the embed
 */
function buildUpcomingSessionsEmbedBody(
    viewModels: UpcomingSessionViewModel[],
    title: string,
    lastUpdatedTimeStamp: Date,
    returnCount: number | 'max' = 5
): string {
    // this divider character appears really long and really thin on discord
    const divider = `\n${'┈'.repeat(25)}\n`;
    const lastUpdatedTimeStampString = `${divider}Last updated: <t:${Math.floor(
        lastUpdatedTimeStamp.getTime() / 1000
    )}:R>`;
    
    if (viewModels.length === 0) {
        return `**There are no upcoming sessions for ${title} in the next 7 days.**${lastUpdatedTimeStampString}`;
    }
    
    if (returnCount === 'max') {
        let currLength = lastUpdatedTimeStampString.length; // current embed message length
        const upcomingSessionStrings: string[] = [];
        // take as many as possible within the discord embed length limit
        for (const viewModel of viewModels) {
            const transformedString = transformViewModelToString(viewModel);
            if (currLength + transformedString.length + divider.length > 4096) {
                break;
            } else {
                currLength += transformedString.length + divider.length;
                upcomingSessionStrings.push(transformedString);
            }
        }
        return `${upcomingSessionStrings.join(divider)}${lastUpdatedTimeStampString}`;
    }

    return (
        viewModels
            // take the first `returnCount` number of sessions
            // TODO: add length validation here
            .slice(0, returnCount)
            .map(transformViewModelToString)
            .join(divider) + lastUpdatedTimeStampString
    );
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
    return [
        `https://www.googleapis.com/calendar/v3/calendars/${args.calendarId}/events?`,
        `&key=${args.apiKey}`,
        `&maxResults=${args.maxResults.toString()}`,
        `&timeMax=${args.timeMax.toISOString()}`,
        `&timeMin=${args.timeMin.toISOString()}`,
        `&orderBy=startTime`,
        `&singleEvents=true`
    ].join('');
}

/**
 * Creates a url from calendar id that takes the user to the public embed
 */
function restorePublicEmbedURL(calendarId: string): string {
    return `https://calendar.google.com/calendar/embed?src=${calendarId}&ctz=America%2FLos_Angeles&mode=WEEK`;
}

/**
 * Fetches 100 calendar events of a server and converts them into individual sessions
 * @param serverId id of the server to fetch for
 * @returns at most 100 UpComingSessionViewModels
 */
async function fetchUpcomingSessions(
    serverId: Snowflake
): Promise<UpcomingSessionViewModel[]> {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const calendarUrl = buildCalendarURL({
        calendarId: CalendarExtensionState.get(serverId).calendarId,
        apiKey: environment.sessionCalendar.YABOB_GOOGLE_API_KEY,
        timeMin: new Date(),
        timeMax: nextWeek,
        maxResults: 100 // change this value to fetch more
    });
    const response = await axios
        .get(calendarUrl, {
            timeout: 5000,
            method: 'GET'
        })
        .catch(() => {
            throw ExpectedCalendarErrors.refreshTimedOut;
        });
    if (response.status !== 200) {
        throw ExpectedCalendarErrors.inaccessibleCalendar;
    }

    const rawEvents = ((await response.data) as calendar_v3.Schema$Events).items;
    if (!rawEvents || rawEvents.length === 0) {
        return [];
    }

    const viewModels: UpcomingSessionViewModel[] = [];
    for (const rawEvent of rawEvents) {
        const unpack = calendarDataSchema.safeParse(rawEvent);
        if (!unpack.success) {
            continue;
        }
        const parsedEvent = unpack.data;
        const parsableCalendarString = parsedEvent.description
            .substring(
                parsedEvent.description.indexOf('YABOB_START') + 'YABOB_START'.length,
                parsedEvent.description.indexOf('YABOB_END')
            )
            .trimStart()
            .trimEnd();
        // now build all the viewModels from this calendar string
        // Example: 'Tutor Name - ECS 20, ECS 36A' will return:
        // {..., queueName: 'ECS 20' }, {..., queueName: 'ECS 36A' }, {..., queueName: '36B'}
        viewModels.push(
            ...composeViewModelsByString(
                serverId,
                rawEvent.summary ?? '',
                parsableCalendarString,
                new Date(parsedEvent.start.dateTime),
                new Date(parsedEvent.end.dateTime),
                rawEvent.location ?? undefined
            )
        );
    }
    return viewModels;
}

/**
 * Parses the summary string and builds the view models for **all queues in the string**
 * - There might be queueNames that are successfully parsed but no queue with such names exist
 * - queue extensions will look for its own name, so we can safely ignore these special cases
 * @param rawSummary unmodified calendar event summary
 * @param parsingString string found the the calendar event description
 * @param start start date of 1 session
 * @param end end date of 1 session
 * @param location where the help session will happen
 * @returns array of successfully parsed view models
 */
function composeViewModelsByString(
    serverId: string,
    rawSummary: string,
    parsingString: string,
    start: Date,
    end: Date,
    location?: string
): UpcomingSessionViewModel[] {
    // parsingString example: 'Tutor Name - ECS 20, ECS 36A, ECS 36B, ECS 122A, ECS 122B'
    // words will be ['TutorName ', ' ECS 20, ECS 36A, ECS 36B, ECS 122A, ECS 122B']
    const words = parsingString.split('-');
    if (words.length !== 2) {
        return [];
    }

    const punctuations = /[,]/g;
    const tutorName = words[0]?.trim();
    const eventQueueNames = words[1]
        ?.trim()
        .split(', ')
        .map(eventQueue => eventQueue.replace(punctuations, '').trim());
    // eventQueues will be:
    // ['ECS 20', 'ECS 36A', 'ECS 36B', 'ECS 122A', 'ECS 122B']
    if (!eventQueueNames || tutorName === undefined) {
        return [];
    }

    return eventQueueNames.map(queueName => ({
        start: start,
        end: end,
        queueName: queueName,
        eventSummary: rawSummary,
        displayName: tutorName,
        discordId:
            CalendarExtensionState.get(serverId).calendarNameDiscordIdMap.get(tutorName),
        location:
            location !== undefined && location.length > 25
                ? location.substring(0, 25) + '...'
                : location
    }));
}

export {
    UpcomingSessionViewModel,
    CalendarConfigBackup,
    fetchUpcomingSessions,
    buildCalendarURL,
    checkCalendarConnection,
    restorePublicEmbedURL,
    buildUpcomingSessionsEmbedBody,
    CALENDAR_LOGGER
};
