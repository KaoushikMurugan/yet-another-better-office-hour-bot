import { Helpee } from "../../models/member-states";

type QueueBackup = {
    studentsInQueue: ReadonlyArray<Omit<Helpee, "member"> & { displayName: string }>;
    name: string;
};

type ServerBackup = {
    serverName: string;
    timeStamp: Date;
    queues: QueueBackup[];
}

export { QueueBackup, ServerBackup };