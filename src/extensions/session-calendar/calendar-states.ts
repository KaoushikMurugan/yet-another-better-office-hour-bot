/** @module SessionCalendar */
import { CalendarQueueExtension } from './calendar-queue-extension.js';
import { GuildId, GuildMemberId } from '../../utils/type-aliases.js';
import LRU from 'lru-cache';
import { environment } from '../../environment/environment-manager.js';
import {
    UpComingSessionViewModel,
    getUpComingTutoringEventsForServer,
    restorePublicEmbedURL
} from './shared-calendar-functions.js';
import { Collection, Guild, Snowflake } from 'discord.js';
import { firebaseDB } from '../../global-states.js';
import { z } from 'zod';
import { logWithTimeStamp } from '../../utils/util-functions.js';
import { CalendarServerExtension } from './calendar-server-extension.js';

/**
 * @module Backups
 */
interface CalendarConfigBackup {
    calendarId: string;
    calendarNameDiscordIdMap: { [key: string]: GuildMemberId };
    publicCalendarEmbedUrl: string;
}

class CalendarExtensionState {
    /**
     * Firebase Backup Schema
     */
    static readonly backupSchema = z.object({
        calendarId: z.string(),
        publicCalendarEmbedUrl: z.string(),
        calendarNameDiscordIdMap: z.record(z.string())
    });

    /**
     * Collection of all the created calendar states
     * - static, shared across all instances
     */
    static states = new Collection<GuildId, CalendarExtensionState>();

    /**
     * Which calendar to read from
     * - See the setup guide for how to find this id
     */
    calendarId = environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID;
    /**
     * Save the data from /make_calendar_string,
     * - key is calendar display name, value is discord id
     */
    displayNameDiscordIdMap: LRU<string, GuildMemberId> = new LRU({ max: 500 });
    /**
     * When was the upcomingSessions cache last updated
     */
    lastUpdatedTimeStamp = new Date();
    /**
     * Full url to the public calendar embed
     */
    publicCalendarEmbedUrl = restorePublicEmbedURL(this.calendarId);
    /**
     * Corresponding queue extensions, their onCalendarStateChange will be called
     * - key is queue name
     */
    queueExtensions: Collection<string, CalendarQueueExtension> = new Collection();
    /**
     * All upcoming sessions of this server
     */
    upcomingSessions: UpComingSessionViewModel[] = [];

    constructor(
        private readonly guild: Guild,
        private readonly serverExtension: CalendarServerExtension // unused, only here as an example
    ) {
        // sets up the refresh timer
        setInterval(async () => {
            await this.refreshCalendarEvents();
            await Promise.all(
                this.queueExtensions.map(queueExt => queueExt.onCalendarStateChange())
            );
        }, 15 * 60 * 1000);
    }

    /**
     * Returns a new CalendarExtensionState for 1 server
     * Uses firebase backup to initialize the Calendar config if the server has a backup
     * @param guild which guild's state to load
     * @returns CalendarExtensionState
     */
    static async load(
        guild: Guild,
        serverExtension: CalendarServerExtension
    ): Promise<CalendarExtensionState> {
        const instance = new CalendarExtensionState(guild, serverExtension);
        CalendarExtensionState.states.set(guild.id, instance);
        await instance.restoreFromBackup(guild.id);
        return instance;
    }

    /**
     * Restores the calendar state from firebase
     * @param serverId
     */
    async restoreFromBackup(serverId: Snowflake): Promise<void> {
        const backupDoc = await firebaseDB
            .collection('calendarBackups')
            .doc(serverId)
            .get();
        if (backupDoc.data() === undefined) {
            return;
        }
        const calendarBackup = CalendarExtensionState.backupSchema.safeParse(
            backupDoc.data()
        );
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
     * Sets the calendar id for the server to `validNewId` and updates the public embed url
     * @param validNewId new google calendar id
     */
    async setCalendarId(validNewId: string): Promise<void> {
        this.calendarId = validNewId;
        // fall back to default embed in case the user forgets to set up a new public embed
        this.publicCalendarEmbedUrl = restorePublicEmbedURL(validNewId);
        this.backupToFirebase();
        await Promise.all(
            this.queueExtensions.map(listener => listener.onCalendarStateChange())
        );
    }

    /**
     * Sets the public embed url for the server to `validUrl`
     * @param validUrl complete embed url string
     */
    async setPublicEmbedUrl(validUrl: string): Promise<void> {
        this.publicCalendarEmbedUrl = validUrl;
        this.backupToFirebase();
        await Promise.all(
            this.queueExtensions.map(listener => listener.onCalendarStateChange())
        );
    }

    /**
     * Adds a new calendar_name -> discord_id mapping to displayNameDiscordIdMap
     * @param calendarName display name on the calendar
     * @param discordId id of the user that used /make_calendar_string
     */
    async updateNameDiscordIdMap(
        calendarName: string,
        discordId: Snowflake
    ): Promise<void> {
        this.displayNameDiscordIdMap.set(calendarName, discordId);
        this.backupToFirebase();
        await Promise.all(
            this.queueExtensions.map(listener => listener.onCalendarStateChange())
        );
    }

    /**
     * Refreshes the upcomingSessions cache
     */
    async refreshCalendarEvents(): Promise<void> {
        this.upcomingSessions = await getUpComingTutoringEventsForServer(this.guild.id);
        this.lastUpdatedTimeStamp = new Date();
    }

    /**
     * Backs up the calendar config to firebase
     * - This is synchronous, we don't need to `await backupToFirebase`
     */
    private backupToFirebase(): void {
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

export { CalendarExtensionState };
