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
} from '../models.js';
import { Guild } from 'discord.js';
import { Logger } from 'pino';
import { LOGGER, firebaseDB } from '../../../global-states.js';
import { between } from '../../../utils/util-functions.js';
import { TrackingDatastore, ReadOptions } from './datastore-interface.js';
import { ConstNoMethod } from '../../../utils/type-aliases.js';

class FirebaseTrackingDataStore implements TrackingDatastore {
    readonly name = 'Firebase';

    private logger: Logger;
    private readonly ATTENDANCE_COLLECTION_NAME = 'attendance';
    private readonly HELP_SESSION_COLLECTION_NAME = 'helpSessions';

    constructor(private db: Firestore) {
        this.logger = LOGGER.child({ datastore: 'Firebase Tracking' });
    }

    private attendanceConverter: FirestoreDataConverter<{
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

    private helpSessionConverter: FirestoreDataConverter<{
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
        guild: ConstNoMethod<Guild>,
        options?: ReadOptions
    ): Promise<AttendanceEntry[]> {
        const doc = await this.db
            .collection(this.ATTENDANCE_COLLECTION_NAME)
            .doc(guild.id)
            .withConverter(this.attendanceConverter)
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
        guild: ConstNoMethod<Guild>,
        options?: ReadOptions
    ): Promise<HelpSessionEntry[]> {
        const doc = await this.db
            .collection(this.HELP_SESSION_COLLECTION_NAME)
            .doc(guild.id)
            .withConverter(this.helpSessionConverter)
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

    async writeAttendance(guild: ConstNoMethod<Guild>, entry: AttendanceEntry) {
        const doc = this.db
            .collection(this.ATTENDANCE_COLLECTION_NAME)
            .doc(guild.id)
            .withConverter(this.attendanceConverter);
        const data = (await doc.get()).data();

        if (data === undefined) {
            this.logger.warn(
                `Creating new attendance doc for guild name=${guild.name} id=${guild.id}`
            );
            await this.db
                .collection(this.ATTENDANCE_COLLECTION_NAME)
                .doc(guild.id)
                .withConverter(this.attendanceConverter)
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

    async writeHelpSessions(guild: ConstNoMethod<Guild>, entries: HelpSessionEntry[]) {
        if (entries.length === 0) {
            return;
        }

        const doc = this.db
            .collection(this.HELP_SESSION_COLLECTION_NAME)
            .doc(guild.id)
            .withConverter(this.helpSessionConverter);
        const data = (await doc.get()).data();

        if (data === undefined) {
            this.logger.warn(
                `Creating new help session doc for guild name=${guild.name} id=${guild.id}`
            );
            await this.db
                .collection(this.HELP_SESSION_COLLECTION_NAME)
                .doc(guild.id)
                .withConverter(this.helpSessionConverter)
                .set({ entries });
            return;
        }

        doc.update({
            entries: FieldValue.arrayUnion(...entries)
        }).catch(err => {
            this.logger.error(err, 'Failed to write help session data to firebase db');
            this.logger.error(`The logs are ${entries}`);
        });
    }
}

const firebaseTrackingDb = new FirebaseTrackingDataStore(firebaseDB);

export { firebaseTrackingDb };
