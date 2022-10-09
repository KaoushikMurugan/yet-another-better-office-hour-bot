import { BaseServerExtension } from "../extension-interface";
import { Firestore } from "firebase-admin/firestore";
import { cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import firebaseAppAdmin from "firebase-admin";
import { AttendingServerV2 } from "../../attending-server/base-attending-server";
import { QueueBackup, ServerBackup } from "../../models/backups";
import {
  FgBlue,
  FgCyan,
  FgYellow,
  ResetColor,
} from "../../utils/command-line-colors";
import { SimpleLogEmbed } from "../../utils/embed-helper";
import environment from "../../environment/environment-manager";

class FirebaseServerBackupExtension extends BaseServerExtension {
  private constructor(
    private readonly firebase_db: Firestore,
    private readonly serverId: string,
    private readonly serverName: string
  ) {
    super();
  }

  static async load(
    serverName: string,
    serverId: string
  ): Promise<FirebaseServerBackupExtension> {
    if (getApps().length === 0) {
      firebaseAppAdmin.initializeApp({
        credential: cert(environment.firebaseCredentials),
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
   * Gets the backup from firebase
   * ----
   * If there's no backup for this serverId, return undefined
   * @param serverId the server to retrieve backup for. This is the id from Guild.id
   */
  override async loadExternalServerData(
    serverId: string
  ): Promise<ServerBackup | undefined> {
    const backupData = await this.firebase_db
      .collection("serverBackups")
      .doc(serverId)
      .get();
    // TODO: add a typeguard here to check if schema match
    return backupData.data() as ServerBackup;
  }

  override async onServerRequestBackup(
    server: Readonly<AttendingServerV2>
  ): Promise<void> {
    await this.backupServerToFirebase(server);
  }

  /**
   * Builds the backup data and sends it to firebase
   * ----
   * @param server the server to backup
   */
  private async backupServerToFirebase(
    server: Readonly<AttendingServerV2>
  ): Promise<void> {
    const queues = server.queues;
    const queueBackups: QueueBackup[] = queues.map((queue) => {
      return {
        studentsInQueue: queue.students.map((student) => {
          return {
            waitStart: student.waitStart,
            upNext: student.upNext,
            displayName: student.member.displayName,
            memberId: student.member.id,
          };
        }),
        name: queue.queueName,
        parentCategoryId: queue.parentCategoryId,
      };
    });
    const serverBackup: ServerBackup = {
      serverName: this.serverName,
      queues: queueBackups,
      timeStamp: new Date(),
      afterSessionMessage: server.afterSessionMessage,
      loggingChannelId: server.loggingChannel?.id ?? "",
      hoursUntilAutoClear:
        server.queues[0]?.hoursUntilAutoClear ?? "AUTO_CLEAR_DISABLED",
    };
    this.firebase_db
      .collection("serverBackups")
      .doc(this.serverId)
      .set(serverBackup)
      .then(() =>
        console.log(
          `[${FgCyan}${new Date().toLocaleString("en-US", {
            timeZone: "PST8PDT",
          })}${ResetColor} ` +
            `${FgYellow}${this.serverName}${ResetColor}]\n` +
            ` - Server & queue data backup successful`
        )
      )
      .catch((err: Error) =>
        console.error("Firebase server backup failed.", err.message)
      );
    await server.sendLogMessage(
      SimpleLogEmbed(`Server Data and Queues Backed-up to Firebase`)
    );
  }
}

export { FirebaseServerBackupExtension };
