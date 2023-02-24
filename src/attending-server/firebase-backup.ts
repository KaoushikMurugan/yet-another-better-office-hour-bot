/** @module FirebaseServerBackup */
import { QueueBackup, ServerBackup, serverBackupSchema } from '../models/backups.js';
import { red } from '../utils/command-line-colors.js';
import { SimpleLogEmbed } from '../utils/embed-helper.js';
import { Optional } from '../utils/type-aliases.js';
import { client, firebaseDB } from '../global-states.js';
import { FrozenServer } from '../extensions/extension-utils.js';
import { logWithTimeStamp } from '../utils/util-functions.js';
import { HelpQueueV2 } from '../help-queue/help-queue.js';
import { AttendingServerV2 } from './base-attending-server.js';

/**
 * Loads the backup data in firebase given a server id
 * @param serverId associated server id, this is also used as document key
 * @returns ServerBackup if a document with this id exists, otherwise undefined
 */
async function loadExternalServerData(serverId: string): Promise<Optional<ServerBackup>> {
    const backupDocument = await firebaseDB
        .collection('serverBackups')
        .doc(serverId)
        .get();
    const unpack = serverBackupSchema.safeParse(backupDocument.data());
    if (!unpack.success) {
        console.warn(
            red(
                `External backups were found for ${
                    client.guilds.cache.get(serverId)?.name
                } but contains invalid data. ` + `Creating new instance.`
            )
        );
        return undefined;
    }
    const backupData: ServerBackup = {
        ...unpack.data,
        queues: unpack.data.queues.map(queue => ({
            ...queue,
            studentsInQueue: queue.studentsInQueue
                .map(student => ({
                    ...student,
                    waitStart: new Date(student.waitStart._seconds * 1000)
                }))
                .sort((a, b) => a.waitStart.getTime() - b.waitStart.getTime())
        })),
        timeStamp: new Date(unpack.data.timeStamp._seconds * 1000),
        autoGiveStudentRole: unpack.data.autoGiveStudentRole ?? false,
        promptHelpTopic: unpack.data.promptHelpTopic ?? false,
        staffRoleId: unpack.data.staffRoleId ?? unpack.data.helperRoleId ?? 'Not Set' // !Migration code
    };
    return backupData;
}

/**
 * Runs a complete backup to firebase for base yabob
 * - Backs up ALL the queues and server settings
 * @param server the server object to backup
 */
function fullServerBackup(server: FrozenServer): void {
    const queueBackups: QueueBackup[] = server.queues.map(queue => ({
        studentsInQueue: queue.students.map(student => ({
            waitStart: student.waitStart,
            displayName: student.member.displayName,
            memberId: student.member.id
        })),
        name: queue.queueName,
        parentCategoryId: queue.parentCategoryId
    }));
    const serverBackup: ServerBackup = {
        serverName: server.guild.name,
        queues: queueBackups,
        timeStamp: new Date(),
        afterSessionMessage: server.afterSessionMessage,
        loggingChannelId: server.loggingChannel?.id ?? '',
        hoursUntilAutoClear: server.queueAutoClearTimeout ?? 'AUTO_CLEAR_DISABLED',
        seriousServer: server.isSerious,
        botAdminRoleId: server.botAdminRoleID,
        staffRoleId: server.staffRoleID,
        studentRoleId: server.studentRoleID,
        autoGiveStudentRole: server.autoGiveStudentRole,
        promptHelpTopic: server.promptHelpTopic
    };
    firebaseDB
        .collection('serverBackups')
        .doc(server.guild.id)
        .set(serverBackup)
        .then(() =>
            logWithTimeStamp(server.guild.name, '- Server & queue data backup successful')
        )
        .catch((err: Error) =>
            console.error('Firebase server backup failed.', err.message)
        );
    server.sendLogMessage(
        SimpleLogEmbed(`All Server Data and Queues Backed-up to Firebase`)
    );
}

/**
 * Runs the backup for server settings only
 * @param server
 */
function backupServerSettings(server: FrozenServer): void {
    firebaseDB
        .collection('serverBackups')
        .doc(server.guild.id)
        .update({
            serverName: server.guild.name,
            timeStamp: new Date(),
            afterSessionMessage: server.afterSessionMessage,
            loggingChannelId: server.loggingChannel?.id ?? '',
            hoursUntilAutoClear: server.queueAutoClearTimeout ?? 'AUTO_CLEAR_DISABLED',
            seriousServer: server.isSerious,
            botAdminRoleId: server.botAdminRoleID,
            staffRoleId: server.staffRoleID,
            studentRoleId: server.studentRoleID,
            autoGiveStudentRole: server.autoGiveStudentRole,
            promptHelpTopic: server.promptHelpTopic
        })
        .then(() =>
            logWithTimeStamp(server.guild.name, '- Server settings backup successful')
        )
        .catch((err: Error) =>
            console.error('Firebase server backup failed.', err.message)
        );
    server.sendLogMessage(
        SimpleLogEmbed('Settings for this server backed-up in firebase')
    );
}

/**
 * Runs the backup for 1 queue only
 * @param queue the queue to backup
 */
function backupQueueData(queue: HelpQueueV2): void {
    const queueBackup: QueueBackup = {
        studentsInQueue: queue.students.map(student => ({
            waitStart: student.waitStart,
            displayName: student.member.displayName,
            memberId: student.member.id
        })),
        name: queue.queueName,
        parentCategoryId: queue.parentCategoryId
    };
    const firebaseDoc = firebaseDB
        .collection('serverBackups')
        .doc(queue.queueChannel.channelObj.guild.id);
    firebaseDoc
        .get()
        .then(response => {
            // grab the full document, modify the queues array, then update
            const data = response.data() as ServerBackup;
            const index = data.queues.findIndex(
                queueData => queueData.parentCategoryId === queue.parentCategoryId
            );
            data.queues.splice(index, 1);
            data.queues.push(queueBackup);
            firebaseDoc
                .update({
                    queues: data.queues
                })
                .then(() =>
                    logWithTimeStamp(
                        queue.channelObject.guild.name,
                        '- Queue backup successful'
                    )
                )
                .catch((err: Error) =>
                    console.error('Firebase queue backup failed.', err.message)
                );
        })
        .catch((err: Error) =>
            console.error('Failed to fetch firebase document.', err.message)
        );
}

// The following functions are method decorators
// https://www.typescriptlang.org/docs/handbook/decorators.html

/**
 * The method decorator inside AttendingServerV2 that executes a full backup
 * @returns the decorated method
 */
function useFullBackup(
    // eslint-disable-next-line @typescript-eslint/ban-types
    target: Object, // no way around this type until TS 5.0
    propertyKey: string,
    descriptor: PropertyDescriptor
): PropertyDescriptor {
    const original = descriptor.value;
    // this parameter specifies the context of the decorator
    descriptor.value = function (this: AttendingServerV2, ...args: unknown[]) {
        // .apply accepts 'this' as the first parameter to specify the context of the function call
        original.apply(this, args);
        fullServerBackup(this);
    };
    return descriptor;
}

/**
 * The method decorator inside AttendingServerV2 that executes a settings backup
 * @returns the decorated method
 */
function useSettingsBackup(
    // eslint-disable-next-line @typescript-eslint/ban-types
    target: Object,
    propertyKey: string,
    descriptor: PropertyDescriptor
): PropertyDescriptor {
    const original = descriptor.value;
    descriptor.value = function (this: AttendingServerV2, ...args: unknown[]) {
        original.apply(this, args);
        backupServerSettings(this);
    };
    return descriptor;
}

/**
 * The method decorator inside HelpQueue that executes a queue backup
 * @returns the decorated method
 */
function useQueueBackup(
    // eslint-disable-next-line @typescript-eslint/ban-types
    target: Object,
    propertyKey: string,
    descriptor: PropertyDescriptor
): PropertyDescriptor {
    const original = descriptor.value;
    descriptor.value = function (this: HelpQueueV2, ...args: unknown[]) {
        original.apply(this, args);
        backupQueueData(this);
    };
    return descriptor;
}

export { loadExternalServerData, useSettingsBackup, useQueueBackup, useFullBackup, backupQueueData };
