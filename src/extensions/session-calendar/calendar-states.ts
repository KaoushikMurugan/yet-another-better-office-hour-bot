// Please see the setup guide on how to find the following credentials.

import { Collection } from "discord.js";
import { initializeApp } from "firebase-admin";
import { getApps, cert } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { CalendarQueueExtension } from "./calendar-queue-extension";
import firebaseCredentials from "../extension-credentials/fbs_service_account_key.json";
import calendarConfig from '../extension-credentials/calendar-config.json';
import { FgCyan, ResetColor } from "../../utils/command-line-colors";

type CalendarConfigBackup = {
    calendarId: string;
    calendarNameDiscordIdMap: { [key: string]: string; }
}

class CalendarExtensionState {
    calendarId: string = calendarConfig.YABOB_DEFAULT_CALENDAR_ID;
    // save the data from /make_calendar_string
    calendarNameDiscordIdMap: Collection<string, string> = new Collection();
    // event listeners, their onCalendarStateChange will be called
    listeners: Collection<string, CalendarQueueExtension> = new Collection();

    constructor(
        private readonly serverId: string,
        private readonly serverName: string,
        private readonly firebase_db: Firestore | null
    ) { }

    static async load(serverId: string, serverName: string): Promise<CalendarExtensionState> {
        if (
            firebaseCredentials.clientEmail === "" &&
            firebaseCredentials.privateKey === "" &&
            firebaseCredentials.projectId === ""
        ) {
            return new CalendarExtensionState(serverId, serverName, null);
        }

        if (getApps().length === 0) {
            initializeApp({
                credential: cert(firebaseCredentials)
            });
        }

        const instance = new CalendarExtensionState(
            serverId,
            serverName,
            getFirestore()
        );

        await instance.restoreFromBackup(serverId);
        return instance;
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

    async restoreFromBackup(serverId: string): Promise<void> {
        if (this.firebase_db === null) {
            return;
        }
        const backupDoc = await this.firebase_db
            .collection("calendarBackups")
            .doc(serverId)
            .get();

        if (backupDoc.data() === undefined) {
            return;
        }

        const calendarBackup = backupDoc.data() as CalendarConfigBackup;

        this.calendarId = calendarBackup.calendarId;
        this.calendarNameDiscordIdMap
            = new Collection(Object.entries(calendarBackup.calendarNameDiscordIdMap));
    }

    private async backupToFirebase(): Promise<void> {
        if (this.firebase_db === null) {
            return;
        }
        const backupData: CalendarConfigBackup = {
            calendarId: this.calendarId,
            calendarNameDiscordIdMap:
                Object.fromEntries(this.calendarNameDiscordIdMap)
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

// static, key is server id, value is 1 calendar extension state
const serverIdStateMap = new Collection<string, CalendarExtensionState>();

export { CalendarExtensionState, serverIdStateMap };

