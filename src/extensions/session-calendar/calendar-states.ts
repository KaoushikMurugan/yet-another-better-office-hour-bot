// Please see the setup guide on how to find the following credentials.

import { Collection } from "discord.js";
import { initializeApp } from "firebase-admin";
import { getApps, cert } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { CalendarQueueExtension } from "./calendar-queue-extension";
import { FgCyan, ResetColor } from "../../utils/command-line-colors";
import { BaseServerExtension } from "../extension-interface";
import { AttendingServerV2 } from "../../attending-server/base-attending-server";

import firebaseCredentials from "../extension-credentials/fbs_service_account_key.json";
import calendarConfig from '../extension-credentials/calendar-config.json';

type CalendarConfigBackup = {
    calendarId: string;
    calendarNameDiscordIdMap: { [key: string]: string; }
}

class CalendarExtensionState {
    calendarId: string = calendarConfig.YABOB_DEFAULT_CALENDAR_ID;
    // save the data from /make_calendar_string, key is calendar display name, value is discord id
    calendarNameDiscordIdMap: Collection<string, string> = new Collection();
    // event listeners, their onCalendarStateChange will be called, key is queue name
    listeners: Collection<string, CalendarQueueExtension> = new Collection();

    constructor(
        private readonly serverId: string,
        private readonly serverName: string,
        private readonly firebase_db?: Firestore
    ) { }

    static async create(serverId: string, serverName: string): Promise<CalendarExtensionState> {
        if (
            firebaseCredentials.clientEmail === "" &&
            firebaseCredentials.privateKey === "" &&
            firebaseCredentials.projectId === ""
        ) {
            return new CalendarExtensionState(serverId, serverName);
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
        await Promise.all([
            this.backupToFirebase(),
            this.listeners.map(listener => listener.onCalendarExtensionStateChange())
        ].flat() as Promise<void>[]);
    }

    async updateNameDiscordIdMap(
        displayName: string,
        discordId: string
    ): Promise<void> {
        this.calendarNameDiscordIdMap.set(displayName, discordId);
        await Promise.all([
            this.backupToFirebase(),
            this.listeners.map(listener => listener.onCalendarExtensionStateChange())
        ].flat() as Promise<void>[]);
    }

    async restoreFromBackup(serverId: string): Promise<void> {
        if (this.firebase_db === undefined) {
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
        if (this.firebase_db === undefined) {
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
                `[${FgCyan}${(new Date()).toLocaleString('us-PT')}${ResetColor}] ` +
                `Calendar config backup successful for ${this.serverName}`
            ))
            .catch((err: Error) => console.error(err.message));
    }
}

class CalendarServerEventListener extends BaseServerExtension {
    override onServerDelete(server: Readonly<AttendingServerV2>): Promise<void> {
        serverIdCalendarStateMap.delete(server.guild.id);
        return Promise.resolve();
    }
}

// static, key is server id, value is 1 calendar extension state
const serverIdCalendarStateMap = new Collection<string, CalendarExtensionState>();

export { CalendarExtensionState, serverIdCalendarStateMap, CalendarServerEventListener };

