import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';
import { authenticate } from '@google-cloud/local-auth';
import path from 'path';
import fs from 'fs';

const CREDENTIALS_PATH = path
    .join(process.cwd(), './src/extensions/session-calendar/google_client_id.json');
const TOKEN_PATH = path
    .join(process.cwd(), './src/extensions/session-calendar/token.json');

// Functions below are adopted from the Google API starter code for NodeJS
// They are very hacky
// TODO: Find the proper way to do this in TS

/**
 * Creates a OAuth2Client
 * ----
 * Expects to find google_client_id.json in the same folder
 * 
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

export { makeClient };