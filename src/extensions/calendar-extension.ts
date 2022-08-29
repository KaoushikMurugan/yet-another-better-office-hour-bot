import { google } from 'googleapis';
import { BaseQueueExtension } from "./base-interface";
import { OAuth2Client } from 'googleapis-common';
import { authenticate } from '@google-cloud/local-auth';
import path from 'path';
import cliendFile from './google_client_id.json';
import fs from 'fs';

const CREDENTIALS_PATH = path.join(process.cwd(), './src/extensions/google_client_id.json');
const TOKEN_PATH = path.join(process.cwd(), './src/extensions/token.json');

class CalendarExtension extends BaseQueueExtension {

    private constructor(

    ) { super(); }

    static async load(): Promise<CalendarExtension> {
        if (process.env.YABOB_GOOGLE_CALENDAR_ID === undefined
            || cliendFile === undefined) {
            return Promise.reject(new Error(
                '\x1b[31mMake sure you have: Calendar ID and google cloud credentials.\x1b[0m'
            ));
        }
        const instance = new CalendarExtension();
        await instance.listEvents();
        return instance;
    }

    override onQueueRenderComplete(): Promise<void> {
        return Promise.resolve();
    }

    private async makeCalendarClient(): Promise<OAuth2Client> {
        const localCredentials = this.loadSavedCredentialsIfExist();
        if (localCredentials !== null) {
            return localCredentials;
        }
        console.log('No cached credentials found. Authenticating...');
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
        return client as unknown as OAuth2Client;
    }

    private loadSavedCredentialsIfExist(): OAuth2Client | null {
        try {
            const content = fs.readFileSync(TOKEN_PATH).toString();
            const credentials = JSON.parse(content);
            return google.auth.fromJSON(credentials) as OAuth2Client;
        } catch (err) {
            return null;
        }
    }

    /**
     * Lists the next 10 events on the user's primary calendar.
     */
    private async listEvents(): Promise<void> {
        const authClient = await this.makeCalendarClient();
        const calendar = google.calendar({
            version: 'v3',
            auth: authClient as unknown as OAuth2Client
        });

        await calendar.events.list({
            calendarId: process.env.YABOB_GOOGLE_CALENDAR_ID,
            timeMin: (new Date()).toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        }).then(res => {
            const events = res.data.items;
            console.log(events);
            if (!events || events.length === 0) {
                console.log('No upcoming events found.');
                return;
            }
            console.log('Upcoming 10 events:');
            events.map((event) => {
                const start = event.start?.dateTime || event.start?.date;
                console.log(`${start} - ${event.summary}`);
            });
        }).catch(e => console.error(e));
    }

}


export { CalendarExtension };