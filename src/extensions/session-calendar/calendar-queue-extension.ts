import { google } from 'googleapis';
import { BaseQueueExtension } from "../extension-interface";
import { ExtensionSetupError } from '../../utils/error-types';
import { OAuth2Client } from 'googleapis-common';
import clientFile from './google_client_id.json';
import { HelpQueueV2 } from '../../help-queue/help-queue';
import { QueueDisplayV2 } from '../../help-queue/queue-display';
import { EmbedColor, SimpleEmbed } from '../../utils/embed-helper';
import { FgBlue, FgRed, ResetColor } from '../../utils/command-line-colors';
import { calendarExtensionConfig } from './calendar-config';
import { makeClient } from './google-auth-helpers';

// ViewModel for 1 tutor's upcoming session
type UpComingSessionViewModel = {
    start: Date;
    end: Date;
    rawSummary: string;
    displayName: string;
    discordID?: string;
    ecsClass: string;
};

/**
 * Calendar Extension for individual queues
 * - All instances read from the same calendar
 * - Each instance only looks for the class it's responsible for
*/
class CalendarExtension extends BaseQueueExtension {

    private upcomingHours: UpComingSessionViewModel[] = []

    private constructor(
        private readonly client: OAuth2Client,
        private readonly renderIndex: number,
    ) { super(); }


    /**
     * Initializes the calendar extension
     * ----
     * @param renderIndex the index of the embed message given by the queue
     * @param queueName name of the queue
    */
    static async load(
        renderIndex: number,
        queueName: string
    ): Promise<CalendarExtension> {
        if (calendarExtensionConfig.YABOB_GOOGLE_CALENDAR_ID === undefined ||
            clientFile === undefined) {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}Make sure you have Calendar ID in calendar-config.ts, ` +
                `The client id in google_client_id.json, ` +
                `and Google Cloud credentials in gcs_service_account_key.json${ResetColor}`
            ));
        }
        const instance = new CalendarExtension(
            await makeClient(),
            renderIndex
        );
        await instance.getUpComingTutoringEvents();
        console.log(
            `[${FgBlue}Calendar Extension${ResetColor}] successfully loaded for '${queueName}'!`
        );
        return instance;
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
        this.upcomingHours = await this.getUpComingTutoringEvents(queue.name);
    }

    /**
     * Embeds the upcoming hours into the queue channel
     * @param queue target queue to embed
     * @param display corresponding display object
    */
    override async onQueueRenderComplete(
        queue: Readonly<HelpQueueV2>,
        display: Readonly<QueueDisplayV2>,
        isClenupRender = false
    ): Promise<void> {
        const embed = SimpleEmbed(
            `Upcoming Hours for ${queue.name}`,
            EmbedColor.NoColor,
            this.upcomingHours
                .map(viewModel => `**${viewModel.displayName}**\t|\t` +
                    `Start: <t:${viewModel.start.getTime().toString().slice(0, -3)}:R>\t|\t` +
                    `End: <t:${viewModel.end.getTime().toString().slice(0, -3)}:R>`)
                .join('\n')
        );
        await display.renderNonQueueEmbeds(
            embed,
            this.renderIndex,
            isClenupRender
        );
    }

    /**
     * Fetches the calendar events from google calendar
     * @param queueName: the queue that this extension instance belongs to
     * - if undefined, simply test for connection to google calendar
    */
    private async getUpComingTutoringEvents(
        queueName?: string
    ): Promise<UpComingSessionViewModel[]> {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const calendar = google.calendar({
            version: 'v3',
            auth: this.client
        });
        const response = await calendar.events.list({
            calendarId: calendarExtensionConfig.YABOB_GOOGLE_CALENDAR_ID,
            timeMin: (new Date()).toISOString(),
            timeMax: nextWeek.toISOString(),
            singleEvents: true,
        });
        const events = response.data.items;
        if (queueName === undefined) {
            return [];
        }
        if (!events || events.length === 0) {
            console.log('No upcoming events found.');
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
                return this.composeViewModel(
                    queueName,
                    event.summary ?? '',
                    new Date(start),
                    new Date(end)
                );
            })
            .filter(s => s !== undefined);
        if (definedEvents.length === 0) {
            return [];
        }
        return definedEvents as UpComingSessionViewModel[];
    }

    /**
     * Builds the view model for the current queue given a summary string
     * @param summary string from getUpComingTutoringEvents
     * @param start start Date
     * @param end end Date
     * @returns undefined if any parsing failed, otherwise a complete view model
    */
    private composeViewModel(
        queueName: string,
        summary: string,
        start: Date,
        end: Date
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
            displayName: tutorName
        };
    }
}

export { CalendarExtension };