/**
 * @package This file provides implementations of write destinations
 * that can be used by the attendance ext
 */

import { Firestore, FirestoreDataConverter, FieldValue } from 'firebase-admin/firestore';
import {
    AttendanceEntry,
    HelpSessionEntry,
    attendanceDocumentSchema,
    helpSessionDocumentSchema
} from './models.js';
import { Logger } from 'pino';
import { GuildMemberId } from '../../utils/type-aliases.js';
import { between } from '../../utils/util-functions.js';
import { LOGGER, firebaseDB } from '../../global-states.js';
import { Guild } from 'discord.js';

type ReadOptions = {
    helperId?: GuildMemberId;
    dateRange?: {
        startUnixMs?: number;
        endUnixMs?: number;
    };
};

interface TrackingDataStore {
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
    readAttendance: (guild: Guild, options?: ReadOptions) => Promise<AttendanceEntry[]>;
    /**
     * Reads help session data from the DB
     * @param guild which guild's data to read
     * @param options optional, specify a custom filter
     * @returns session data after filtering if specified, otherwise returns everything
     */
    readHelpSession?: (
        guild: Guild,
        options?: ReadOptions
    ) => Promise<HelpSessionEntry[]>;
    /**
     * Writes 1 attendance entry and a list of help session entries to the datastore
     * - This is called after a helper uses /stop, so the data is only related to 1 helper
     * - Avoids the additional complexity of writing at arbitrary intervals
     * @param guild the guild where the data came from
     * @param attendanceEntry complete attendance entry
     * @param helpSessionEntries help session entries
     */
    writeAttendance: (guild: Guild, attendanceEntry: AttendanceEntry) => Promise<void>;
    writeHelpSessions: (
        guild: Guild,
        helpSessionEntries: HelpSessionEntry[]
    ) => Promise<void>;
}

class FirebaseTrackingDataStore implements TrackingDataStore {
    readonly name = 'Firebase';

    private logger: Logger;
    private readonly ATTENDANCE_COLLECTION_NAME = 'attendance';
    private readonly HELP_SESSION_COLLECTION_NAME = 'helpSessions';

    constructor(private db: Firestore) {
        this.logger = LOGGER.child({ datastore: 'Firebase Tracking' });
    }

    private static attendanceConverter: FirestoreDataConverter<{
        entries: AttendanceEntry[];
    }> = {
        fromFirestore: snapshot => {
            const unpack = attendanceDocumentSchema.safeParse(snapshot.data());
            if (!unpack.success) {
                return { entries: [] };
            }
            return unpack.data;
        },
        toFirestore: modelObject => modelObject
    };

    private static helpSessionConverter: FirestoreDataConverter<{
        entries: HelpSessionEntry[];
    }> = {
        fromFirestore: snapshot => {
            const unpack = helpSessionDocumentSchema.safeParse(snapshot.data());
            if (!unpack.success) {
                return { entries: [] };
            }
            return unpack.data;
        },
        toFirestore: modelObject => modelObject
    };

    async readAttendance(
        guild: Guild,
        options?: ReadOptions
    ): Promise<AttendanceEntry[]> {
        const doc = await this.db
            .collection(this.ATTENDANCE_COLLECTION_NAME)
            .doc(guild.id)
            .withConverter(FirebaseTrackingDataStore.attendanceConverter)
            .get();
        const data = doc.data();

        if (data === undefined) {
            return [];
        }

        if (options === undefined) {
            return data.entries;
        }

        const [dateRangeStart, dateRangeEnd] = [
            options.dateRange?.startUnixMs ?? -Infinity,
            options.dateRange?.endUnixMs ?? Infinity
        ];
        return data.entries.filter(
            entry =>
                (options.helperId === undefined ||
                    entry.helper.id === options.helperId) &&
                (between(entry.helpStartUnixMs, dateRangeStart, dateRangeEnd) ||
                    between(entry.helpEndUnixMs, dateRangeStart, dateRangeEnd))
        );
    }

    async readHelpSessions(
        guild: Guild,
        options?: ReadOptions
    ): Promise<HelpSessionEntry[]> {
        const doc = await this.db
            .collection(this.HELP_SESSION_COLLECTION_NAME)
            .doc(guild.id)
            .withConverter(FirebaseTrackingDataStore.helpSessionConverter)
            .get();
        const data = doc.data();

        if (data === undefined) {
            return [];
        }

        if (options === undefined) {
            return data.entries;
        }

        const [dateRangeStart, dateRangeEnd] = [
            options.dateRange?.startUnixMs ?? -Infinity,
            options.dateRange?.endUnixMs ?? Infinity
        ];

        return data.entries.filter(
            entry =>
                (options.helperId === undefined ||
                    entry.helper.id === options.helperId) &&
                (between(entry.sessionStartUnixMs, dateRangeStart, dateRangeEnd) ||
                    between(entry.sessionEndUnixMs, dateRangeStart, dateRangeEnd))
        );
    }

    async writeAttendance(guild: Guild, entry: AttendanceEntry) {
        const doc = this.db
            .collection(this.ATTENDANCE_COLLECTION_NAME)
            .doc(guild.id)
            .withConverter(FirebaseTrackingDataStore.attendanceConverter);
        const data = (await doc.get()).data();

        if (data === undefined) {
            this.logger.warn(
                `Creating new attendance doc for guild name=${guild.name} id=${guild.id}`
            );
            await this.db
                .collection(this.ATTENDANCE_COLLECTION_NAME)
                .doc(guild.id)
                .withConverter(FirebaseTrackingDataStore.attendanceConverter)
                .set({ entries: [entry] });
            return;
        }
        doc.update({
            entries: FieldValue.arrayUnion(entry)
        }).catch(err => {
            this.logger.error(err, 'Failed to write attendance data to firebase db');
            this.logger.error(`The logs are ${entry}`);
        });
    }

    async writeHelpSessions(guild: Guild, entries: HelpSessionEntry[]) {
        if (entries.length === 0) {
            return;
        }

        const doc = this.db
            .collection(this.HELP_SESSION_COLLECTION_NAME)
            .doc(guild.id)
            .withConverter(FirebaseTrackingDataStore.helpSessionConverter);
        const data = (await doc.get()).data();

        if (data === undefined) {
            this.logger.warn(
                `Creating new help session doc for guild name=${guild.name} id=${guild.id}`
            );
            await this.db
                .collection(this.HELP_SESSION_COLLECTION_NAME)
                .doc(guild.id)
                .withConverter(FirebaseTrackingDataStore.helpSessionConverter)
                .set({ entries });
            return;
        }
        console.log(entries);

        doc.update({
            entries: FieldValue.arrayUnion(...entries)
        }).catch(err => {
            this.logger.error(err, 'Failed to write help session data to firebase db');
            this.logger.error(`The logs are ${entries}`);
        });
    }
}

const firebaseTrackingDb = new FirebaseTrackingDataStore(firebaseDB);

export { TrackingDataStore, firebaseTrackingDb };
