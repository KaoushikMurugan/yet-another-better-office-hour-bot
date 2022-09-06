import { calendar_v3 } from 'googleapis';
import { BaseQueueExtension } from "../extension-interface";
import { ExtensionSetupError } from '../../utils/error-types';
import { HelpQueueV2 } from '../../help-queue/help-queue';
import { QueueDisplayV2 } from '../../help-queue/queue-display';
import { EmbedColor } from '../../utils/embed-helper';
import { FgRed, ResetColor } from '../../utils/command-line-colors';
import { serverIdStateMap } from './calendar-states';
import { MessageEmbed, MessageActionRow, MessageButton } from 'discord.js';
import { CalendarConnectionError } from './calendar-command-extension';

import calendarConfig from '../extension-credentials/calendar-config.json';

// ViewModel for 1 tutor's upcoming session
type UpComingSessionViewModel = {
    start: Date;
    end: Date;
    rawSummary: string;
    displayName: string;
    ecsClass: string;
    discordId?: string;
};

/**
 * Calendar Extension for individual queues
 * ----
 * - All instances read from the same calendar
 * - Each instance only looks for the class it's responsible for
*/
class CalendarQueueExtension extends BaseQueueExtension {

    private upcomingHours: UpComingSessionViewModel[] = [];
    private display!: Readonly<QueueDisplayV2>; // late init in onQueueCreate

    private constructor(
        private readonly renderIndex: number,
        private readonly queueName: string,
        private readonly serverId: string
    ) { super(); }

    /**
     * Initializes the calendar extension
     * ----
     * @param renderIndex the index of the embed message given by the queue
     * @param queueName name of the queue
    */
    static async load(
        renderIndex: number,
        queueName: string,
        serverId: string
    ): Promise<CalendarQueueExtension> {
        if (calendarConfig.YABOB_DEFAULT_CALENDAR_ID.length === 0) {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}Make sure you have Calendar ID ` +
                `& API key in calendar-config.ts.${ResetColor}`
            ));
        }
        if (!serverIdStateMap.has(serverId)) {
            return Promise.reject(new ExtensionSetupError(
                'The command level extension is required.'
            ));
        }

        const instance = new CalendarQueueExtension(renderIndex, queueName, serverId);
        await getUpComingTutoringEvents(serverId, queueName)
            .catch(() => Promise.reject((`Failed to load calendar extension.`)));

        serverIdStateMap.get(serverId)?.listeners.set(queueName, instance);
        return instance;
    }

    /**
     * Grabs the display instance
     * ----
     * @param display the instance
    */
    override async onQueueCreate(
        _queue: Readonly<HelpQueueV2>,
        display: Readonly<QueueDisplayV2>
    ): Promise<void> {
        this.display = display;
    }

    /**
     * Every time queue emits onQueuePeriodicUpdate
     * fecth new events and update cached viewModel
     * ----
     * @param queue target queue to get calendar for
    */
    override async onQueuePeriodicUpdate(
        queue: Readonly<HelpQueueV2>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _isFirstCall = false
    ): Promise<void> {
        this.upcomingHours = await getUpComingTutoringEvents(this.serverId, queue.name);
    }

    /**
     * Embeds the upcoming hours into the queue channel
     * ----
     * @param isClenupRender if the queue requested a cleanup
    */
    override async onQueueRenderComplete(
        _queue: Readonly<HelpQueueV2>,
        isClenupRender = false
    ): Promise<void> {
        await this.renderCalendarEmbeds(false, isClenupRender);
    }

    /**
     * Event listener/subscriber for changes in calendarExtensionStates
     * ----
    */
    async onCalendarExtensionStateChange(): Promise<void> {
        // true for refresh b/c the refresh button was used.
        // false for isCleanup b/c we are just editing the embed
        await this.renderCalendarEmbeds(true, false);
    }

    private async renderCalendarEmbeds(
        refresh = false,
        isCleanupRender = false
    ): Promise<void> {
        this.upcomingHours = refresh
            ? await getUpComingTutoringEvents(this.serverId, this.queueName)
            : this.upcomingHours;
        const upcomingHoursEmbed = new MessageEmbed()
            .setTitle(`Upcoming Hours for ${this.queueName}`)
            .setDescription(
                this.upcomingHours.length > 0
                    ? this.upcomingHours
                        .map(viewModel =>
                            `**${viewModel.discordId !== undefined
                                ? `<@${viewModel.discordId}>`
                                : viewModel.displayName
                            }**\t|\t` +
                            `Start: <t:${viewModel.start.getTime().toString().slice(0, -3)}:R>\t|\t` +
                            `End: <t:${viewModel.end.getTime().toString().slice(0, -3)}:R>`)
                        .join('\n')
                    : `There are no upcoming sessions for ${this.queueName} in the next 7 days.`
            )
            .setColor(EmbedColor.NoColor);

        const refreshButton = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("refresh " + this.queueName)
                    .setEmoji("🔄")
                    .setLabel("Refresh Upcoming Hours")
                    .setStyle("PRIMARY")
            );

        await this.display.renderNonQueueEmbeds(
            {
                embeds: [upcomingHoursEmbed],
                components: [refreshButton]
            },
            this.renderIndex,
            isCleanupRender
        ).catch(async () =>
            this.display.renderNonQueueEmbeds(
                {
                    embeds: [upcomingHoursEmbed],
                    components: [refreshButton]
                },
                this.renderIndex,
                true
            )
        );
    }
}

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

    const punctuations = /[.,/#!$%^&*;:{}=\-_`~()]/g;
    const tutorName = words[0]?.trim();
    const ecsClasses = words[1]?.trim().split(' ')
        .map(ecsClass => ecsClass
            ?.replace(punctuations, '')
            .trim());
    // ["ECS", "20,", "36A,", "36B,", "122A,", "122B"]
    ecsClasses?.shift(); // Remove the ECS

    if (ecsClasses?.length === 0 || tutorName === undefined) {
        return undefined;
    }

    const targteClass = ecsClasses?.find(ecsClass => queueName === `ECS ${ecsClass}`);

    if (targteClass === undefined) {
        return undefined;
    }

    return {
        start: start,
        end: end,
        ecsClass: targteClass,
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


export { CalendarQueueExtension, getUpComingTutoringEvents, buildCalendarURL };