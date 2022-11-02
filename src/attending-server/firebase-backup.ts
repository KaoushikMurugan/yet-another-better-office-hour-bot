/** @module FirebaseServerBackup */
import {
    BaseServerExtension,
    IServerExtension
} from '../extensions/extension-interface.js';
import { QueueBackup, ServerBackup } from '../models/backups.js';
import { blue, cyan, yellow } from '../utils/command-line-colors.js';
import { SimpleLogEmbed } from '../utils/embed-helper.js';
import { Optional } from '../utils/type-aliases.js';
import { Guild } from 'discord.js';
import { firebaseDB } from '../global-states.js';
import { FrozenServer, sendLogs } from '../extensions/extension-utils.js';

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
        const backupDocument = await firebaseDB
            .collection('serverBackups')
            .doc(serverId)
            .get();
        const backupData = backupDocument.data() as ServerBackup;
        backupData.queues.forEach(queue => {
            queue.studentsInQueue.forEach(student => {
                student.waitStart = new Date(
                    // weird hack here becaue firebase stores dates as this object type
                    (
                        student.waitStart as unknown as {
                            _nanoseconds: number;
                            _seconds: number;
                        }
                    )._seconds * 1000
                );
            });
        });
        // TODO: add a typeguard here to check if schema match
        return backupData;
    }

    /**
     * Saves a backup of the current server state to firebase
     * @param server
     */
    override async onServerRequestBackup(server: FrozenServer): Promise<void> {
        await this.backupServerToFirebase(server);
    }

    /**
     * Builds the backup data and sends it to firebase
     * @param server the server to backup
     * @noexcept error is logged to the console
     */
    private async backupServerToFirebase(server: FrozenServer): Promise<void> {
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
                parentCategoryId: queue.parentCategoryId
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
        await sendLogs(
            server.guild.id,
            SimpleLogEmbed(`Server Data and Queues Backed-up to Firebase`)
        );
    }
}

export { FirebaseServerBackupExtension };
