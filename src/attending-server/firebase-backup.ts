/** @module FirebaseServerBackup */
import { BaseServerExtension, IServerExtension } from '../extensions/extension-interface';
import { AttendingServerV2 } from './base-attending-server';
import { QueueBackup, ServerBackup } from '../models/backups';
import { blue, cyan, yellow } from '../utils/command-line-colors';
import { SimpleLogEmbed } from '../utils/embed-helper';
import { Optional } from '../utils/type-aliases';
import { Guild } from 'discord.js';
import { firebaseDB } from '../global-states';

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
            `[${blue('Firebase Backup')}] ` + `successfully loaded for '${guild.name}'!`
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
        const backupData = await firebaseDB
            .collection('serverBackups')
            .doc(serverId)
            .get();
        // TODO: add a typeguard here to check if schema match
        return backupData.data() as ServerBackup;
    }

    /**
     * Saves a backup of the current server state to firebase
     * @param server
     */
    override async onServerRequestBackup(
        server: Readonly<AttendingServerV2>
    ): Promise<void> {
        await this.backupServerToFirebase(server);
    }

    /**
     * Builds the backup data and sends it to firebase
     * @param server the server to backup
     * @noexcept error is logged to the console
     */
    private async backupServerToFirebase(
        server: Readonly<AttendingServerV2>
    ): Promise<void> {
        const queueBackups: QueueBackup[] = server.queues.map(queue => {
            return {
                studentsInQueue: queue.students.map(student => {
                    return {
                        waitStart: student.waitStart,
                        upNext: student.upNext,
                        displayName: student.member.displayName,
                        memberId: student.member.id
                    };
                }),
                name: queue.queueName,
                parentCategoryId: queue.parentCategoryId,
                seriousModeEnabled: queue.seriousModeEnabled
            };
        });
        const serverBackup: ServerBackup = {
            serverName: this.guild.name,
            queues: queueBackups,
            timeStamp: new Date(),
            afterSessionMessage: server.afterSessionMessage,
            loggingChannelId: server.loggingChannel?.id ?? '',
            hoursUntilAutoClear:
                server.queues[0]?.timeUntilAutoClear ?? 'AUTO_CLEAR_DISABLED',
            seriousServer: server.queues[0]?.seriousModeEnabled ?? false
        };
        firebaseDB
            .collection('serverBackups')
            .doc(this.guild.id)
            .set(serverBackup)
            .then(() =>
                console.log(
                    `[${cyan(
                        new Date().toLocaleString('en-US', {
                            timeZone: 'PST8PDT'
                        })
                    )} ` +
                        `${yellow(this.guild.name)}]\n` +
                        ` - Server & queue data backup successful`
                )
            )
            .catch((err: Error) =>
                console.error('Firebase server backup failed.', err.message)
            );
        await server.sendLogMessage(
            SimpleLogEmbed(`Server Data and Queues Backed-up to Firebase`)
        );
    }
}

export { FirebaseServerBackupExtension };
