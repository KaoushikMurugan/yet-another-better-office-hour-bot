import { Guild } from 'discord.js';
import { ConstNoMethod, GuildMemberId } from '../../../utils/type-aliases.js';
import { AttendanceEntry, HelpSessionEntry } from '../models.js';

type UnixMs = number;

/**
 * Read options when reading from a tracking datastore
 */
type ReadOptions = {
    /**
     * If specified, only return data related to this helper
     */
    helperId?: GuildMemberId;
    /**
     * If specified, only return data within this date range, in unix milliseconds
     */
    dateRange?: {
        /**
         * defaults to -inf
         */
        startUnixMs?: UnixMs;
        /**
         * defaults to +inf
         */
        endUnixMs?: UnixMs;
    };
};

interface TrackingDatastore {
    /**
     * Name of the datastore
     */
    readonly name: string;
    /**
     * Reads attendance data from the DB
     * @param guild which guild's data to read
     * @param options optional, specify a custom filter
     * @returns attendance data after filtering if specified, otherwise returns everything
     */
    readAttendance: (
        guild: ConstNoMethod<Guild>,
        options?: ReadOptions
    ) => Promise<AttendanceEntry[]>;
    /**
     * Reads help session data from the DB
     * @param guild which guild's data to read
     * @param options optional, specify a custom filter
     * @returns session data after filtering if specified, otherwise returns everything
     */
    readHelpSession?: (
        guild: ConstNoMethod<Guild>,
        options?: ReadOptions
    ) => Promise<HelpSessionEntry[]>;
    /**
     * Writes 1 attendance entry to the datastore
     * - This is called after a helper uses /stop, so the data is only related to 1 helper
     * - Avoids the additional complexity of writing at arbitrary intervals
     * @param guild the guild where the data came from
     * @param attendanceEntry complete attendance entry
     */
    writeAttendance: (
        guild: ConstNoMethod<Guild>,
        attendanceEntry: AttendanceEntry
    ) => Promise<void>;
    /**
     * Writes a list of help session entries to the datastore
     * - This is called in onStudentLeaveVBC, so the data is only related to 1 student
     * @param guild the guild where the data came from
     * @param helpSessionEntries complete help session entries
     */
    writeHelpSessions: (
        guild: ConstNoMethod<Guild>,
        helpSessionEntries: HelpSessionEntry[]
    ) => Promise<void>;
}

export { TrackingDatastore, ReadOptions };
