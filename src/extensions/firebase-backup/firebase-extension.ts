import { BaseServerExtension } from "../extension-interface";
import { Firestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { AttendingServerV2 } from "../../attending-server/base-attending-server";
import { QueueBackup, ServerBackup } from "./firebase-models/backups";
import { FgBlue, FgCyan, ResetColor } from "../../utils/command-line-colors";

import environment from '../../environment/environment-manager';
import { SimpleLogEmbed } from "../../utils/embed-helper";

class FirebaseServerBackupExtension extends BaseServerExtension {
    private constructor(
        private readonly firebase_db: Firestore,
        private readonly serverId: string,
        private readonly serverName: string
    ) { super(); }

    static async load(
        serverName: string,
        serverId: string
    ): Promise<FirebaseServerBackupExtension> {
        if (getApps().length === 0) {
            initializeApp({
                credential: cert(environment.firebaseCredentials)
            });
        }
        const instance = new FirebaseServerBackupExtension(
            getFirestore(),
            serverId,
            serverName
        );
        console.log(
            `[${FgBlue}Firebase Backup${ResetColor}] ` +
            `successfully loaded for '${serverName}'!`
        );
        return instance;
    }

    /**
     * Periodically backs up server data to firebase
     * ----
     * @param server the server to read data from
     * @param isFirstCall whether it's triggeredon server create
    */
    override async onServerPeriodicUpdate(
        server: Readonly<AttendingServerV2>,
        isFirstCall = false
    ): Promise<void> {
        // if invoked on server init, don't back up yet to prevent accidental override
        if (isFirstCall) {
            return Promise.resolve();
        }

        const queues = server.helpQueues;
        const queueBackups: QueueBackup[] = queues.map(queue => {
            return {
                studentsInQueue: queue.studentsInQueue.map(student => {
                    return {
                        waitStart: student.waitStart,
                        upNext: student.upNext,
                        displayName: student.member.displayName,
                        memberId: student.member.id
                    };
                }),
                name: queue.name,
                parentCategoryId: queue.parentCategoryId
            };
        });
        const serverBackup: ServerBackup = {
            serverName: this.serverName,
            queues: queueBackups,
            timeStamp: new Date(),
            afterSessionMessage: server.afterSessionMessage,
            loggingChannel: server.loggingChannel?.id ?? ''
        };

        this.firebase_db
            .collection("serverBackups")
            .doc(this.serverId)
            .set(serverBackup)
            .then(() => console.log(
                `[${FgCyan}${(new Date()).toLocaleString('us-PT')}${ResetColor}] ` +
                `Backup successful for ${this.serverName}`
            ))
            .catch((err: Error) => console.error(err.message));
        server.sendLogMessage(SimpleLogEmbed(`Server Data and Queues Backed-up to Firebase`));
    }

    /**
     * Gets the backup from firebase
     * ----
     * If there's no backup for this serverId, return undefined
     * @param serverId the server to retrieve backup for. This is the id from Guild.id
    */
    override async loadExternalServerData(serverId: string): Promise<ServerBackup | undefined> {
        const backupData = await this.firebase_db
            .collection("serverBackups")
            .doc(serverId)
            .get();
        return <ServerBackup>backupData.data();
    }
}

export { FirebaseServerBackupExtension };