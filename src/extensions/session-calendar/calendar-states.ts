// Please see the setup guide on how to find the following credentials.

import { Collection } from "discord.js";
import { initializeApp } from "firebase-admin";
import { getApps, cert } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { CalendarQueueExtension } from "./calendar-queue-extension";
import firebaseCredentials from "../extension-credentials/fbs_service_account_key.json";
import calendarConfig from '../extension-credentials/calendar-config.json';
import { FgCyan, ResetColor } from "../../utils/command-line-colors";

// key is server id, value is 1 calendar extension state
const serverIdStateMap = new Collection<string, CalendarExtensionState>();

class CalendarExtensionState {
    calendarId: string = calendarConfig.YABOB_DEFAULT_CALENDAR_ID;
    // save the data from /make_calendar_string
    calendarNameDiscordIdMap: Collection<string, string> = new Collection();
    // event listeners, their onCalendarStateChange will be called
    listeners: Collection<string, CalendarQueueExtension> = new Collection();
    firebase_db: Firestore;

    constructor(
        private readonly serverId: string,
        private readonly serverName: string
    ) {
        if (getApps().length === 0) {
            initializeApp({
                credential: cert(firebaseCredentials)
            });
        }
        this.firebase_db = getFirestore();
    }

    async setCalendarId(validNewId: string): Promise<void> {
        this.calendarId = validNewId;
        await this.backupToFirebase();
    }

    async updateNameDiscordIdMap(
        displayName: string,
        discordId: string
    ): Promise<void> {
        this.calendarNameDiscordIdMap.set(displayName, discordId);
        await this.backupToFirebase();
    }

    private async backupToFirebase(): Promise<void> {
        const backupData = {
            calendarId: this.calendarId,
            calendarNameDiscordIdMap: this.calendarNameDiscordIdMap.toJSON()
        };
        this.firebase_db
            .collection("calendarBackups")
            .doc(this.serverId)
            .set(backupData)
            .then(() => console.log(
                `[${FgCyan}${(new Date()).toLocaleString()}${ResetColor}] ` +
                `Calendar config backup successful for ${this.serverName}`
            ))
            .catch((err: Error) => console.error(err.message));
    }
}


export { CalendarExtensionState, serverIdStateMap };

