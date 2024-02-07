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
import { Guild } from 'discord.js';
import { Logger } from 'pino';
import { ATTENDANCE_LOGGER } from './shared-functions.js';

interface TrackingDataStore {
    write: (
        attendanceEntry: AttendanceEntry,
        helpSessionEntries: HelpSessionEntry[]
    ) => Promise<void>;
}

class FirebaseTrackingDataStore implements TrackingDataStore {
    private logger: Logger;
    private readonly ATTENDANCE_COLLECTION_NAME = 'attendance';
    private readonly HELP_SESSION_COLLECTION_NAME = 'helpSessions';

    constructor(
        private db: Firestore,
        private guild: Guild
    ) {
        this.logger = ATTENDANCE_LOGGER.child({ guild: guild.name });
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
        attendanceEntry: AttendanceEntry,
        helpSessionEntries: HelpSessionEntry[]
    ): Promise<void> {
        await Promise.allSettled([
            this.writeAttendance(attendanceEntry),
            this.writeHelpSessions(helpSessionEntries)
        ]);
    }

    private async writeAttendance(entry: AttendanceEntry) {
        const doc = await this.db
            .collection(this.ATTENDANCE_COLLECTION_NAME)
            .doc(this.guild.id)
            .withConverter(FirebaseTrackingDataStore.attendanceConverter)
            .get();
        const data = doc.data();

        if (!doc.exists || data === undefined) {
            this.logger.warn(
                `Creating new attendance doc for ${this.guild.name}, id=${this.guild.id}`
            );
            await this.db
                .collection(this.ATTENDANCE_COLLECTION_NAME)
                .doc(this.guild.id)
                .withConverter(FirebaseTrackingDataStore.attendanceConverter)
                .set({ entries: [] });
            return;
        }

        this.db
            .collection(this.ATTENDANCE_COLLECTION_NAME)
            .doc(this.guild.id)
            .update({
                entries: [...data.entries, entry]
            })
            .catch(err =>
                this.logger.error(err, 'Failed to write attendance data to firebase db')
            );
    }

    private async writeHelpSessions(entries: HelpSessionEntry[]) {
        const doc = await this.db
            .collection(this.HELP_SESSION_COLLECTION_NAME)
            .doc(this.guild.id)
            .withConverter(FirebaseTrackingDataStore.helpSessionConverter)
            .get();
        const data = doc.data();

        if (!doc.exists || data === undefined) {
            this.logger.warn(
                `Creating new help session doc for ${this.guild.name}, id=${this.guild.id}`
            );
            await this.db
                .collection(this.HELP_SESSION_COLLECTION_NAME)
                .doc(this.guild.id)
                .withConverter(FirebaseTrackingDataStore.helpSessionConverter)
                .set({ entries: [] });
            return;
        }

        this.db
            .collection(this.HELP_SESSION_COLLECTION_NAME)
            .doc(this.guild.id)
            .withConverter(FirebaseTrackingDataStore.helpSessionConverter)
            .update({
                entries: [...data.entries, ...entries]
            })
            .catch(err =>
                this.logger.error(err, 'Failed to write help session data to firebase db')
            );
    }
}

export { TrackingDataStore, FirebaseTrackingDataStore };
