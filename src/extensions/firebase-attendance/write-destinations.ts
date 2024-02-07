/**
 * @package This file provides implementations of write destinations
 * that can be used by the attendance ext
 */

import { Firestore, FirestoreDataConverter } from 'firebase-admin/firestore';
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
    readonly name: string;
    readAttendance: (guild: Guild, options?: ReadOptions) => Promise<AttendanceEntry[]>;
    readHelpSession?: (
        guild: Guild,
        options?: ReadOptions
    ) => Promise<HelpSessionEntry[]>;
    write: (
        guild: Guild,
        attendanceEntry: AttendanceEntry,
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

    async write(
        guild: Guild,
        attendanceEntry: AttendanceEntry,
        helpSessionEntries: HelpSessionEntry[]
    ): Promise<void> {
        await Promise.allSettled([
            this.writeAttendance(guild, attendanceEntry),
            this.writeHelpSessions(guild, helpSessionEntries)
        ]);
    }

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
                    entry.helperDiscordId === options.helperId) &&
                (between(entry.sessionStartUnixMs, dateRangeStart, dateRangeEnd) ||
                    between(entry.sessionEndUnixMs, dateRangeStart, dateRangeEnd))
        );
    }

    private async writeAttendance(guild: Guild, entry: AttendanceEntry) {
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
                .set({ entries: [] });
            return;
        }

        doc.update({
            entries: [...data.entries, entry]
        }).catch(err =>
            this.logger.error(err, 'Failed to write attendance data to firebase db')
        );
    }

    private async writeHelpSessions(guild: Guild, entries: HelpSessionEntry[]) {
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
                .set({ entries: [] });
            return;
        }

        this.db
            .collection(this.HELP_SESSION_COLLECTION_NAME)
            .doc(guild.id)
            .withConverter(FirebaseTrackingDataStore.helpSessionConverter)
            .update({
                entries: [...data.entries, ...entries]
            })
            .catch(err =>
                this.logger.error(err, 'Failed to write help session data to firebase db')
            );
    }
}

const firebaseTrackingDb = new FirebaseTrackingDataStore(firebaseDB);

export { TrackingDataStore, firebaseTrackingDb };
