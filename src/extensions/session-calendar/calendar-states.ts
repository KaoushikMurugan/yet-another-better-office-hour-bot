/** @module SessionCalendar */
import { CalendarQueueExtension } from './calendar-queue-extension.js';
import { BaseServerExtension, IServerExtension } from '../extension-interface.js';
import { GuildId, GuildMemberId } from '../../utils/type-aliases.js';
import LRU from 'lru-cache';
import { environment } from '../../environment/environment-manager.js';
import { restorePublicEmbedURL } from './shared-calendar-functions.js';
import { Collection, Guild } from 'discord.js';
import { firebaseDB } from '../../global-states.js';
import { FrozenServer } from '../extension-utils.js';
import { z } from 'zod';
import { logWithTimeStamp } from '../../utils/util-functions.js';

/**
 * @module Backups
 */
type CalendarConfigBackup = {
    calendarId: string;
    publicCalendarEmbedUrl: string;
    calendarNameDiscordIdMap: { [key: string]: string };
};

/** Firebase Backup Schema */
const calendarConfigBackupSchema = z.object({
    calendarId: z.string(),
    publicCalendarEmbedUrl: z.string(),
    calendarNameDiscordIdMap: z.record(z.string())
});

class CalendarExtensionState extends BaseServerExtension implements IServerExtension {
    calendarId = environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID;
    // save the data from /make_calendar_string, key is calendar display name, value is discord id
    displayNameDiscordIdMap: LRU<string, GuildMemberId> = new LRU({ max: 500 });
    // event listeners, their onCalendarStateChange will be called, key is queue name
    listeners: Collection<string, CalendarQueueExtension> = new Collection();
    // full url to the public calendar embed
    publicCalendarEmbedUrl = restorePublicEmbedURL(this.calendarId);

    constructor(private readonly guild: Guild) {
        super();
    }

    /**
     * Returns a new CalendarExtensionState for the server with the given id and name
     *
     * Uses firebase backup to intialize the Calendar config if the server has a backup
     * @param serverId
     * @param serverName
     * @returns CalendarExtensionState
     */
    static async load(guild: Guild): Promise<CalendarExtensionState> {
        const firebaseCredentials = environment.firebaseCredentials;
        if (
            firebaseCredentials.clientEmail === '' &&
            firebaseCredentials.privateKey === '' &&
            firebaseCredentials.projectId === ''
        ) {
            return new CalendarExtensionState(guild);
        }
        const instance = new CalendarExtensionState(guild);
        await instance.restoreFromBackup(guild.id);
        return instance;
    }

    /**
     * If a server gets deleted, remove it from the calendar server map
     * @param server
     * @returns
     */
    override onServerDelete(server: FrozenServer): Promise<void> {
        calendarStates.delete(server.guild.id);
        return Promise.resolve();
    }

    /**
     * Sets the calendar id for the server to `validNewId` and updates the public embed url
     * @param validNewId
     */
    async setCalendarId(validNewId: string): Promise<void> {
        this.calendarId = validNewId;
        // fall back to default embed in case the user forgets to set up a new public embed
        this.publicCalendarEmbedUrl = restorePublicEmbedURL(validNewId);
        await Promise.all([
            this.backupToFirebase(),
            ...this.listeners.map(listener => listener.onCalendarStateChange())
        ]);
    }

    /**
     * Sets the public embed url for the server to `validUrl`
     * @param validUrl
     */
    async setPublicEmbedUrl(validUrl: string): Promise<void> {
        this.publicCalendarEmbedUrl = validUrl;
        await Promise.all([
            this.backupToFirebase(),
            ...this.listeners.map(listener => listener.onCalendarStateChange())
        ]);
    }

    /**
     * Adds a new calendar_name -> discord_id mapping to displayNameDiscordIdMap
     * @param calendarName
     * @param discordId
     */
    async updateNameDiscordIdMap(calendarName: string, discordId: string): Promise<void> {
        this.displayNameDiscordIdMap.set(calendarName, discordId);
        // fire and forget, calendar api is slow and should not block yabob's response
        await Promise.all([
            this.backupToFirebase(),
            ...this.listeners.map(listener => listener.onCalendarStateChange())
        ]);
    }

    /**
     * Restores the calendar config from firebase
     * @param serverId
     */
    async restoreFromBackup(serverId: string): Promise<void> {
        const backupDoc = await firebaseDB
            .collection('calendarBackups')
            .doc(serverId)
            .get();
        if (backupDoc.data() === undefined) {
            return;
        }
        const calendarBackup = calendarConfigBackupSchema.safeParse(backupDoc.data());
        if (!calendarBackup.success) {
            return;
        }
        this.calendarId = calendarBackup.data.calendarId;
        this.publicCalendarEmbedUrl = calendarBackup.data.publicCalendarEmbedUrl;
        if (this.publicCalendarEmbedUrl.length === 0) {
            this.publicCalendarEmbedUrl = restorePublicEmbedURL(this.calendarId);
        }
        this.displayNameDiscordIdMap.load(
            Object.entries(calendarBackup.data.calendarNameDiscordIdMap).map(
                ([key, value]) => [key, { value: value }]
            )
        );
    }

    /**
     * Backs up the calendar config to firebase
     */
    private async backupToFirebase(): Promise<void> {
        const backupData: CalendarConfigBackup = {
            calendarId: this.calendarId,
            publicCalendarEmbedUrl: this.publicCalendarEmbedUrl,
            calendarNameDiscordIdMap: Object.fromEntries(
                this.displayNameDiscordIdMap
                    .dump()
                    .map(([key, LRUEntry]) => [key, LRUEntry.value])
            )
        };
        firebaseDB
            .collection('calendarBackups')
            .doc(this.guild.id)
            .set(backupData)
            .then(() =>
                logWithTimeStamp(this.guild.name, '- Calendar config backup successful')
            )
            .catch((err: Error) =>
                console.error('Firebase calendar backup failed.', err.message)
            );
    }
}

/** static, key is guild id, value is 1 calendar extension state */
const calendarStates = new Collection<GuildId, CalendarExtensionState>();

export { CalendarExtensionState, calendarStates };
