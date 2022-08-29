import { google } from 'googleapis';
import { BaseQueueExtension, ExtensionSetupError } from "./extension-interface";
import { OAuth2Client } from 'googleapis-common';
import { authenticate } from '@google-cloud/local-auth';
import path from 'path';
import cliendFile from './google_client_id.json';
import fs from 'fs';

const CREDENTIALS_PATH = path.join(process.cwd(), './src/extensions/google_client_id.json');
const TOKEN_PATH = path.join(process.cwd(), './src/extensions/token.json');

class CalendarExtension extends BaseQueueExtension {

    private constructor(
        private readonly client: OAuth2Client,
        private readonly calendarID: string
    ) { super(); }

    static async load(calendarID?: string): Promise<CalendarExtension> {
        if (calendarID === undefined
            || cliendFile === undefined) {
            return Promise.reject(new ExtensionSetupError(
                '\x1b[31mMake sure you have Calendar ID and google cloud credentials in .env.\x1b[0m'
            ));
        }
        const instance = new CalendarExtension(await makeClient(), calendarID);
        await instance.listEvents();
        return instance;
    }

    override onQueueRenderComplete(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Lists the next 10 events on the user's primary calendar.
     */
    private async listEvents(): Promise<void> {
        const calendar = google.calendar({
            version: 'v3',
            auth: this.client
        });

        await calendar.events.list({
            calendarId: this.calendarID,
            timeMin: (new Date()).toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        }).then(res => {
            const events = res.data.items;
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

/**
 * Function below are adopted from the Google API starter code
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