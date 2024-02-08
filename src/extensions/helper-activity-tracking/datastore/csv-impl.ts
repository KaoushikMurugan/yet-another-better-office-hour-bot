import { Guild } from 'discord.js';
import { AttendanceEntry, HelpSessionEntry } from '../models.js';
import { ReadOptions, TrackingDataStore } from './datastore-interface.js';
import { ConstNoMethod } from '../../../utils/type-aliases.js';

/**
 * Local database implementation of a tracking datastore
 */
class LocalSqlTrackingDataStore implements TrackingDataStore {
    readonly name = 'Local SQL Tracking';

    private readonly ATTENDANCE_FILE_PREFIX = 'attendance';
    private readonly HELP_SESSION_FILE_PREFIX = 'helpSessions';

    async readAttendance(
        guild: ConstNoMethod<Guild>,
        options?: ReadOptions
    ): Promise<AttendanceEntry[]> {
        return [];
    }

    async readHelpSessions(
        guild: ConstNoMethod<Guild>,
        options?: ReadOptions
    ): Promise<HelpSessionEntry[]> {
        return [];
    }

    async writeAttendance(guild: ConstNoMethod<Guild>, entry: AttendanceEntry) {}

    async writeHelpSessions(guild: ConstNoMethod<Guild>, entries: HelpSessionEntry[]) {}
}

const localTrackingDb = new LocalSqlTrackingDataStore();

export { localTrackingDb };
