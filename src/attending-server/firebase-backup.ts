/** @module FirebaseServerBackup */
import {
    BaseServerExtension,
    IServerExtension
} from '../extensions/extension-interface.js';
import { QueueBackup, ServerBackup, serverBackupSchema } from '../models/backups.js';
import { blue } from '../utils/command-line-colors.js';
import { SimpleLogEmbed } from '../utils/embed-helper.js';
import { Optional } from '../utils/type-aliases.js';
import { Guild } from 'discord.js';
import { firebaseDB } from '../global-states.js';
import { FrozenServer } from '../extensions/extension-utils.js';
import { logWithTimeStamp } from '../utils/util-functions.js';

/**
 * Built in backup extension
 */
class FirebaseServerBackupExtension
    extends BaseServerExtension
    implements IServerExtension
{
    constructor(private readonly guild: Guild) {
        super();
        console.log(
            `[${blue('Firebase Backup')}] successfully loaded for '${guild.name}'!`
        );
    }

    /**
     * Gets the backup from firebase
     * If there's no backup for this serverId, return undefined
     * @param serverId the server to retrieve backup for. This is the id from Guild.id
     */
    override async loadExternalServerData(
        serverId: string
    ): Promise<Optional<ServerBackup>> {
        const backupDocument = await firebaseDB
            .collection('serverBackups')
            .doc(serverId)
            .get();
        const unpack = serverBackupSchema.safeParse(backupDocument.data());
        if (!unpack.success) {
            console.warn(
                `External backups were found for ${this.guild.name} but contains invalid data. ` +
                    `Creating new instance.`
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
            staffRoleId: unpack.data.staffRoleId ?? unpack.data.helperRoleId
        };
        return backupData;
    }

    /**
     * Saves a backup of the current server state to firebase
     * @param server
     */
    override async onServerRequestBackup(server: FrozenServer): Promise<void> {
        this.backupServerToFirebase(server);
    }

    /**
     * Builds the backup data and sends it to firebase
     * @param server the server to backup
     * @noexcept error is logged to the console
     */
    private backupServerToFirebase(server: FrozenServer): void {
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
            serverName: this.guild.name,
            queues: queueBackups,
            timeStamp: new Date(),
            afterSessionMessage: server.afterSessionMessage,
            loggingChannelId: server.loggingChannel?.id ?? '',
            hoursUntilAutoClear:
                server.queues[0]?.timeUntilAutoClear ?? 'AUTO_CLEAR_DISABLED',
            seriousServer: server.queues[0]?.seriousModeEnabled ?? false,
            botAdminRoleId: server.botAdminRoleID,
            staffRoleId: server.staffRoleID,
            studentRoleId: server.studentRoleID,
            autoGiveStudentRole: server.autoGiveStudentRole
        };
        firebaseDB
            .collection('serverBackups')
            .doc(this.guild.id)
            .set(serverBackup)
            .then(() =>
                logWithTimeStamp(
                    this.guild.name,
                    '- Server & queue data backup successful'
                )
            )
            .catch((err: Error) =>
                console.error('Firebase server backup failed.', err.message)
            );
        server.sendLogMessage(
            SimpleLogEmbed(`Server Data and Queues Backed-up to Firebase`)
        );
    }
}

export { FirebaseServerBackupExtension };
