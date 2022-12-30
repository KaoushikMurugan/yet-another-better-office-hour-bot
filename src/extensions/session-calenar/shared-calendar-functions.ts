/** @module SessionCalendar */
/**
 * @packageDocumentation
 * This file contains the common validation / util functions
 *  used by the calendar extension
 */
import { calendar_v3 } from 'googleapis/build/src/apis/calendar';
import { CalendarExtensionState, calendarStates } from './calendar-states.js';
import axios from 'axios';
import { environment } from '../../environment/environment-manager.js';
import { Optional, WithRequired } from '../../utils/type-aliases.js';
import { ExpectedCalendarErrors } from './calendar-constants/expected-calendar-errors.js';
import { QueueChannel } from '../../attending-server/base-attending-server.js';
import {
    ChatInputCommandInteraction,
    ButtonInteraction,
    ModalSubmitInteraction
} from 'discord.js';
import { isTextChannel } from '../../utils/util-functions.js';
import { z } from 'zod';
import { FrozenServer } from '../extension-utils.js';
import { isServerInteraction } from '../../interaction-handling/shared-validations.js';

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

const calendarDataSchema = z.object({
    start: z.object({
        dateTime: z.string()
    }),
    end: z.object({
        dateTime: z.string()
    }),
    description: z.string()
});

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
        calendarId: calendarStates.get(serverId)?.calendarId ?? '',
        apiKey: environment.sessionCalendar.YABOB_GOOGLE_API_KEY,
        timeMin: new Date(),
        timeMax: nextWeek,
        maxResults: 100
    });
    const response = await axios.default
        .get(calendarUrl, {
            timeout: 5000,
            method: 'GET'
        })
        .catch(() => {
            throw ExpectedCalendarErrors.refreshTimedout;
        });
    if (response.status !== 200) {
        throw ExpectedCalendarErrors.inaccessibleCalendar;
    }
    const responseJSON = await response.data;
    const rawEvents = (responseJSON as calendar_v3.Schema$Events)?.items;
    if (!rawEvents || rawEvents.length === 0) {
        return [];
    }
    const definedViewModels: UpComingSessionViewModel[] = [];
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
        const viewModel = composeViewModel(
            serverId,
            queueName,
            rawEvent.summary ?? '',
            parsableCalendarString ?? '',
            new Date(parsedEvent.start.dateTime),
            new Date(parsedEvent.end.dateTime),
            rawEvent.location ?? undefined
        );
        // trim to avoid overflow
        if (viewModel?.location !== undefined) {
            viewModel.location =
                viewModel.location?.length > 25
                    ? viewModel.location?.substring(0, 25) + '...'
                    : viewModel.location;
        }
        if (viewModel !== undefined) {
            definedViewModels.push(viewModel);
        }
    }
    return definedViewModels;
}

/**
 * Attempts to connect to the google calendar
 * @param newCalendarId
 * @returns data from the google calendar
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
    const response = await axios.default
        .get(calendarUrl, {
            timeout: 5000,
            method: 'GET'
        })
        .catch(() => {
            throw ExpectedCalendarErrors.refreshTimedout;
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
        discordId: calendarStates.get(serverId)?.displayNameDiscordIdMap.get(tutorName),
        location: location
    };
}

/**
 * Builds the body message of the upcoming sessions embed
 * @param viewModels models from {@link getUpComingTutoringEvents}
 * @param queueChannel which queue channel to look for
 * @param returnCount the MAXIMUM number of events to render
 * @returns string that goes into the embed
 */
function composeUpcomingSessionsEmbedBody(
    viewModels: UpComingSessionViewModel[],
    queueChannel: QueueChannel,
    lastUpdatedTimeStamp: Date,
    returnCount = 5
): string {
    return (
        (viewModels.length > 0
            ? viewModels
                  .slice(0, returnCount) // take the first 10
                  .map(
                      viewModel =>
                          `**${
                              viewModel.discordId !== undefined
                                  ? `<@${viewModel.discordId}>`
                                  : viewModel.displayName
                          }**\t|\t` +
                          `**${viewModel.eventSummary}**\n` +
                          `Start: <t:${viewModel.start
                              .getTime()
                              .toString()
                              .slice(0, -3)}:R>\t|\t` +
                          `End: <t:${viewModel.end
                              .getTime()
                              .toString()
                              .slice(0, -3)}:R>` +
                          `${
                              viewModel.location
                                  ? `\t|\tLocation: ${viewModel.location}`
                                  : ``
                          }`
                  )
                  .join(`\n${'-'.repeat(30)}\n`)
            : `**There are no upcoming sessions for ${queueChannel.queueName} in the next 7 days.**`) +
        `\n${'-'.repeat(30)}\nLast updated: <t:${Math.floor(
            lastUpdatedTimeStamp.getTime() / 1000
        )}:R>`
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
        `&timeMax=${args.timeMax.toISOString()}`,
        `&timeMin=${args.timeMin.toISOString()}`,
        `&maxResults=${args.maxResults.toString()}`,
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
 * Checks if the calendar interactoin is safe to execute
 * @param interaction
 * @returns server and state object tuple
 */
function isServerCalendarInteraction<
    T extends
        | ChatInputCommandInteraction<'cached'>
        | ButtonInteraction<'cached'>
        | ModalSubmitInteraction<'cached'>
>(
    interaction: T
): [
    server: FrozenServer,
    state: CalendarExtensionState,
    interaction: WithRequired<T, 'channel' | 'channelId'>
] {
    const server = isServerInteraction(interaction);
    const state = calendarStates.get(server.guild.id);
    if (!state || !isTextChannel(interaction.channel)) {
        throw ExpectedCalendarErrors.nonServerInteraction(interaction.guild.name);
    }
    // already checked for non-null channelId, idk why type inference doesn't work
    // destructuring works but it has massive memory overhead
    return [server, state, interaction as WithRequired<T, 'channel' | 'channelId'>];
}

export {
    getUpComingTutoringEvents,
    composeViewModel,
    buildCalendarURL,
    UpComingSessionViewModel,
    checkCalendarConnection,
    restorePublicEmbedURL,
    composeUpcomingSessionsEmbedBody,
    isServerCalendarInteraction
};