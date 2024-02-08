import { Guild } from 'discord.js';
import { AttendanceEntry, HelpSessionEntry } from '../models.js';
import { ReadOptions, TrackingDataStore } from './datastore-interface.js';

class LocalCsvTrackingDataStore implements TrackingDataStore {
    readonly name = 'Local CSV Tracking';

    async readAttendance(
        guild: Guild,
        options?: ReadOptions
    ): Promise<AttendanceEntry[]> {
        return [];
    }

    async readHelpSessions(
        guild: Guild,
        options?: ReadOptions
    ): Promise<HelpSessionEntry[]> {
        return [];
    }

    async writeAttendance(guild: Guild, entry: AttendanceEntry) {}

    async writeHelpSessions(guild: Guild, entries: HelpSessionEntry[]) {}
}
