import { google } from 'googleapis';
import { BaseQueueExtension } from "./extension-interface";
import { ExtensionSetupError } from '../utils/error-types';
import { OAuth2Client } from 'googleapis-common';
import { authenticate } from '@google-cloud/local-auth';
import path from 'path';
import cliendFile from './google_client_id.json';
import fs from 'fs';
import { HelpQueueV2 } from '../help-queue/help-queue';
import { QueueDisplayV2 } from '../help-queue/queue-display';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper';

// TODO: This is ugly, see if we can change it to imports
const CREDENTIALS_PATH = path.join(process.cwd(), './src/extensions/google_client_id.json');
const TOKEN_PATH = path.join(process.cwd(), './src/extensions/token.json');

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
        private readonly calendarID: string,
        private readonly renderIndex: number,
    ) { super(); }

    static async load(
        renderIndex: number,
        calendarID?: string,
    ): Promise<CalendarExtension> {
        if (calendarID === undefined ||
            cliendFile === undefined) {
            return Promise.reject(new ExtensionSetupError(
                '\x1b[31mMake sure you have Calendar ID and google cloud credentials in .env.\x1b[0m'
            ));
        }
        const instance = new CalendarExtension(
            await makeClient(),
            calendarID,
            renderIndex);
        console.log(await instance.getUpComingTutoringEvents());
        console.log(
            `[\x1b[34mCalendar Extension\x1b[0m] successfully loaded!`
        );
        return instance;
    }

    /**
     * Every time queue emits onQueuePeriodicUpdate
     * fecth new events and update cached viewModel
    */
    override async onQueuePeriodicUpdate(queue: Readonly<HelpQueueV2>): Promise<void> {
        this.upcomingHours = await this.getUpComingTutoringEvents(queue.name);
        console.log(this.upcomingHours);
    }

    /**
     * Embeds the upcoming hours into the queue channel
     * @param queue target queue to embed
     * @param display corresponding display object
    */
    override async onQueueRenderComplete(
        queue: Readonly<HelpQueueV2>,
        display: Readonly<QueueDisplayV2>
    ): Promise<void> {
        const embed = SimpleEmbed(
            `Upcoming Hours for ${queue.name}`,
            EmbedColor.NoColor,
            this.upcomingHours
                .map(viewModel => `${viewModel.displayName} | ` +
                    `Starts at: ${viewModel.start.toLocaleString()}\t` +
                    `Ends at: ${viewModel.end.toLocaleString()}`)
                .join('\n')
        );
        await display.renderNonQueueEmbeds(
            embed,
            this.renderIndex
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
            calendarId: this.calendarID,
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
                return this.composeViewModels(
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
    private composeViewModels(
        queueName: string,
        summary: string,
        start: Date,
        end: Date
    ): UpComingSessionViewModel | undefined {
        // Summary format: "Tutor Name - ECS 20, 36A, 36B, 122A, 122B"
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
            // remove the puncuations and any trailing/leading white spaces
            ecsClass: targteClass,
            rawSummary: summary,
            displayName: tutorName
        };
    }
}

/**
 * Function below are adopted from the Google API starter code for NodeJS
 * They are very hacky
 * TODO: Find the proper way to do this in TS
*/

async function makeClient(): Promise<OAuth2Client> {
    const localCredentials = loadSavedCredentials();
    if (localCredentials !== undefined) {
        return localCredentials;
    }
    console.log('No cached credentials found. Authenticating...');
    // this will launch an auth window in the browser
    const client = await authenticate({
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        keyfilePath: CREDENTIALS_PATH,
    });
    const content = fs.readFileSync(CREDENTIALS_PATH).toString();
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    fs.writeFileSync(TOKEN_PATH, payload);
    // Google apis have multiple classes named OAuth2Client
    // the cast is a temporary solution 
    return client as unknown as OAuth2Client;
}

function loadSavedCredentials(): OAuth2Client | undefined {
    try {
        const content = fs.readFileSync(TOKEN_PATH).toString();
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials) as OAuth2Client;
    } catch (err) {
        return undefined;
    }
}

export { CalendarExtension };