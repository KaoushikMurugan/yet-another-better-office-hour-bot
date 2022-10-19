import { Collection } from 'discord.js';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { CalendarQueueExtension } from './calendar-queue-extension';
import { cyan, yellow } from '../../utils/command-line-colors';
import { BaseServerExtension } from '../extension-interface';
import { AttendingServerV2 } from '../../attending-server/base-attending-server';
import { GuildId, GuildMemberId } from '../../utils/type-aliases';
import LRU from 'lru-cache';

import environment from '../../environment/environment-manager';
import { restorePublicEmbedURL } from './shared-calendar-functions';

type CalendarConfigBackup = {
    calendarId: string;
    publicCalendarEmbedUrl: string;
    calendarNameDiscordIdMap: { [key: string]: string };
};

class CalendarExtensionState {
    calendarId = environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID;
    // save the data from /make_calendar_string, key is calendar display name, value is discord id
    displayNameDiscordIdMap: LRU<string, GuildMemberId> = new LRU({ max: 500 });
    // event listeners, their onCalendarStateChange will be called, key is queue name
    listeners: Collection<string, CalendarQueueExtension> = new Collection();
    // full url to the public calendar embed
    publicCalendarEmbedUrl = restorePublicEmbedURL(this.calendarId);

    constructor(
        private readonly serverId: string,
        private readonly serverName: string,
        private readonly firebaseDB?: Firestore
    ) {}

    static async create(
        serverId: string,
        serverName: string
    ): Promise<CalendarExtensionState> {
        const firebaseCredentials = environment.firebaseCredentials;
        if (
            firebaseCredentials.clientEmail === '' &&
            firebaseCredentials.privateKey === '' &&
            firebaseCredentials.projectId === ''
        ) {
            return new CalendarExtensionState(serverId, serverName);
        }
        if (getApps().length === 0) {
            initializeApp({
                credential: cert(firebaseCredentials)
            });
        }
        const instance = new CalendarExtensionState(serverId, serverName, getFirestore());
        await instance.restoreFromBackup(serverId);
        return instance;
    }

    async setCalendarId(validNewId: string): Promise<void> {
        this.calendarId = validNewId;
        // fall back to default embed in case the user forgets to set up a new public embed
        this.publicCalendarEmbedUrl = restorePublicEmbedURL(validNewId);
        await Promise.all([
            this.backupToFirebase(),
            ...this.listeners.map(listener => listener.onCalendarExtensionStateChange())
        ]);
    }

    async setPublicEmbedUrl(validUrl: string): Promise<void> {
        this.publicCalendarEmbedUrl = validUrl;
        await Promise.all([
            this.backupToFirebase(),
            ...this.listeners.map(listener => listener.onCalendarExtensionStateChange())
        ]);
    }

    async updateNameDiscordIdMap(displayName: string, discordId: string): Promise<void> {
        this.displayNameDiscordIdMap.set(displayName, discordId);
        await this.backupToFirebase();
        // fire and forget, calendar api is slow and should not block yabob's response
        void Promise.all(
            this.listeners.map(listener => listener.onCalendarExtensionStateChange())
        ).catch(() =>
            console.error(
                `Calendar refresh timed out from updateNameDiscordIdMap triggered by ${displayName}`
            )
        );
    }

    async restoreFromBackup(serverId: string): Promise<void> {
        if (this.firebaseDB === undefined) {
            return;
        }
        const backupDoc = await this.firebaseDB
            .collection('calendarBackups')
            .doc(serverId)
            .get();
        if (backupDoc.data() === undefined) {
            return;
        }
        const calendarBackup = backupDoc.data() as CalendarConfigBackup;
        this.calendarId = calendarBackup.calendarId;
        // TODO: coalescing is temporary, this is just migration code
        // once all servers have migrated to the new backup model we can safely remove it
        this.publicCalendarEmbedUrl =
            calendarBackup.publicCalendarEmbedUrl ??
            restorePublicEmbedURL(this.calendarId);
        this.displayNameDiscordIdMap.load(
            Object.entries(calendarBackup.calendarNameDiscordIdMap).map(
                ([key, value]) => [key, { value: value }]
            )
        );
    }

    private async backupToFirebase(): Promise<void> {
        if (this.firebaseDB === undefined) {
            return;
        }
        const backupData: CalendarConfigBackup = {
            calendarId: this.calendarId,
            publicCalendarEmbedUrl: this.publicCalendarEmbedUrl,
            calendarNameDiscordIdMap: Object.fromEntries(
                this.displayNameDiscordIdMap
                    .dump()
                    .map(([key, LRUEntry]) => [key, LRUEntry.value])
            )
        };
        this.firebaseDB
            .collection('calendarBackups')
            .doc(this.serverId)
            .set(backupData)
            .then(() =>
                console.log(
                    `[${cyan(
                        new Date().toLocaleString('en-US', {
                            timeZone: 'PST8PDT'
                        })
                    )} ` +
                        `${yellow(this.serverName)}]\n` +
                        ` - Calendar config backup successful`
                )
            )
            .catch((err: Error) =>
                console.error('Firebase calendar backup failed.', err.message)
            );
    }
}

class CalendarServerEventListener extends BaseServerExtension {
    override onServerDelete(server: Readonly<AttendingServerV2>): Promise<void> {
        serverIdCalendarStateMap.delete(server.guild.id);
        return Promise.resolve();
    }
}

// static, key is guild id, value is 1 calendar extension state
const serverIdCalendarStateMap = new Collection<GuildId, CalendarExtensionState>();

export { CalendarExtensionState, serverIdCalendarStateMap, CalendarServerEventListener };
