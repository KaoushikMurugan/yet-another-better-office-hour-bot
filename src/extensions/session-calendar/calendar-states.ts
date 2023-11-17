/** @module SessionCalendar */
import { CalendarQueueExtension } from './calendar-queue-extension.js';
import { GuildId, GuildMemberId } from '../../utils/type-aliases.js';
import { LRUCache as LRU } from 'lru-cache';
import { environment } from '../../environment/environment-manager.js';
import {
    CalendarConfigBackup,
    UpcomingSessionViewModel,
    CALENDAR_LOGGER,
    checkCalendarConnection,
    fetchUpcomingSessions,
    restorePublicEmbedURL
} from './shared-calendar-functions.js';
import { Collection, Guild, Snowflake } from 'discord.js';
import { client, firebaseDB } from '../../global-states.js';
import { z } from 'zod';
import { CalendarServerExtension } from './calendar-server-extension.js';
import { ExpectedCalendarErrors } from './calendar-constants/expected-calendar-errors.js';
import { ServerExtension } from '../extension-interface.js';
import { Logger } from 'pino';

/**
 * The state of the calendar extension
 * - CalendarQueueExtension's behavior will purely depend on the data in the corresponding state instance
 */
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
     * - readonly doesn't prevent the map contents from being changed,
     *  but it locks the reference so no new maps can be assigned to this variable
     */
    static readonly allStates = new Collection<GuildId, CalendarExtensionState>();

    /**
     * Gets a guild level state by id
     * @param serverId
     * @returns state object of the associated server
     * @throws CommandParseError if the state object doesn't exist
     */
    static get(serverId: Snowflake): CalendarExtensionState {
        const state = CalendarExtensionState.allStates.get(serverId);
        if (!state) {
            throw ExpectedCalendarErrors.notInitialized(
                client.guilds.cache.get(serverId)?.name
            );
        }
        return state;
    }

    /**
     * Which calendar to read from
     * - See the setup guide for how to find this id
     */
    calendarId = environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID;
    /**
     * Save the data from /make_calendar_string,
     * - key is calendar display name, value is discord id
     */
    calendarNameDiscordIdMap: LRU<string, GuildMemberId> = new LRU({ max: 100 });
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
    upcomingSessions: UpcomingSessionViewModel[] = [];

    private logger: Logger;

    /**
     * @param guild
     * @param serverExtension unused, only here as an example of initialization order
     */
    constructor(
        private readonly guild: Guild,
        private readonly serverExtension: Omit<
            CalendarServerExtension,
            keyof ServerExtension
        >
    ) {
        this.logger = CALENDAR_LOGGER.child({ guild: guild.name });
    }

    /**
     * Returns a new CalendarExtensionState for 1 server
     * - firebase backup is loaded if it exists
     * @param guild which guild's state to load
     * @returns CalendarExtensionState
     */
    static async load(
        guild: Guild,
        serverExtension: Omit<CalendarServerExtension, keyof ServerExtension>
    ): Promise<CalendarExtensionState> {
        const instance = new CalendarExtensionState(guild, serverExtension);
        await instance.restoreFromBackup(guild.id);
        CalendarExtensionState.allStates.set(guild.id, instance);
        // design limitation, refresh needs to happen after the instance is in allStates
        await instance.refreshCalendarEvents();
        return instance;
    }

    /**
     * Emits the state change event to all the queues
     * @param targetQueueName if specified, only this queue extension will be notified
     */
    async emitStateChangeEvent(targetQueueName?: string): Promise<void> {
        await (targetQueueName
            ? this.queueExtensions.get(targetQueueName)?.onCalendarStateChange()
            : Promise.all(
                  this.queueExtensions.map(listener => listener.onCalendarStateChange())
              ));
    }

    /**
     * Refreshes the upcomingSessions cache for the corresponding server
     * - **Requires the allStates map to have this instance**
     */
    async refreshCalendarEvents(): Promise<void> {
        this.upcomingSessions = await fetchUpcomingSessions(this.guild.id);
        this.lastUpdatedTimeStamp = new Date();
    }

    /**
     * Restores the calendar state from firebase
     * - This is an instance method because all properties can be initialized without backup
     * - For other extensions it's easier to make this function static and return the backup data
     * @param serverId server id of associated backup doc
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
        if (
            calendarBackup.data.calendarId !==
            environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID
        ) {
            // check if bob still has access to the backup calendarId
            // we can only guarantee that the default id works
            await checkCalendarConnection(calendarBackup.data.calendarId)
                .then(() => {
                    this.calendarId = calendarBackup.data.calendarId;
                })
                .catch(() => {
                    this.calendarId =
                        environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID;
                });
        }
        this.publicCalendarEmbedUrl = calendarBackup.data.publicCalendarEmbedUrl;
        if (this.publicCalendarEmbedUrl.length === 0) {
            this.publicCalendarEmbedUrl = restorePublicEmbedURL(this.calendarId);
        }
        this.calendarNameDiscordIdMap.load(
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
        await this.refreshCalendarEvents();
        await this.emitStateChangeEvent();
    }

    /**
     * Sets the public embed url for the server to `validUrl`
     * @param validUrl complete embed url string
     */
    async setPublicEmbedUrl(validUrl: string): Promise<void> {
        this.publicCalendarEmbedUrl = validUrl;
        this.backupToFirebase();
        await this.emitStateChangeEvent();
    }

    /**
     * Adds a new calendar_name -> discord_id mapping to displayNameDiscordIdMap
     * @param displayName display name on the calendar
     * @param discordId id of the user that used /make_calendar_string
     */
    async updateNameDiscordIdMap(
        displayName: string,
        discordId: Snowflake
    ): Promise<void> {
        this.calendarNameDiscordIdMap.set(displayName, discordId);
        // update the values in the viewModels
        // without doing another calendar refresh
        for (const viewModel of this.upcomingSessions) {
            if (viewModel.displayName === displayName) {
                viewModel.discordId = discordId;
            }
        }
        this.backupToFirebase();
        await this.emitStateChangeEvent();
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
                this.calendarNameDiscordIdMap
                    .dump()
                    .map(([key, LRUEntry]) => [key, LRUEntry.value])
            )
        };
        firebaseDB
            .collection('calendarBackups')
            .doc(this.guild.id)
            .set(backupData)
            .then(() => this.logger.info(`Calendar config backup successful`))
            .catch((err: Error) =>
                this.logger.error(err, 'Firebase calendar backup failed.')
            );
    }
}

export { CalendarExtensionState };
