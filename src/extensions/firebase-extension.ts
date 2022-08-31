import { BaseServerExtension } from "./extension-interface";
import { Firestore } from "firebase-admin/firestore";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import firebase_creds from "../../fbs_service_account_key.json";
import { AttendingServerV2 } from "../attending-server/base-attending-server";
import { QueueBackup, ServerBackup } from "./firebase-models/backups";


class FirebaseLoggingExtension extends BaseServerExtension {
    private constructor(
        private readonly firebase_db: Firestore,
        private readonly serverId: string,
        private readonly serverName: string
    ) {
        super();
    }

    static async load(serverName: string, serverId: string): Promise<FirebaseLoggingExtension> {
        const instance = new FirebaseLoggingExtension(
            getFirestore(initializeApp({
                credential: cert(firebase_creds)
            })),
            serverId,
            serverName
        );
        console.log(
            `[\x1b[34mFirebase Logging Extension\x1b[0m] successfully loaded for '${serverName}'!`
        );
        return instance;
    }

    override async onServerPeriodicUpdate(server: Readonly<AttendingServerV2>): Promise<void> {
        const queues = server.helpQueues;
        const queueBackups: QueueBackup[] = queues.map(queue => {
            return {
                studentsInQueue: queue.studentsInQueue.map(student => {
                    return {
                        waitStart: student.waitStart,
                        upNext: student.upNext,
                        displayName: student.member.displayName
                    };
                }),
                name: queue.name,
            };
        });
        const serverBackup: ServerBackup = {
            serverName: this.serverName,
            queues: queueBackups,
            timeStamp: new Date()
        };

        this.firebase_db
            .collection("serverBackups")
            .doc(this.serverId)
            .set(serverBackup)
            .then(() => console.log(`Backup successful for ${this.serverName}`))
            .catch((err: Error) => console.error(err.message));
    }
}

export { FirebaseLoggingExtension };