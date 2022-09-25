import { Helpee } from './member-states';

type QueueBackup = {
    studentsInQueue: ReadonlyArray<Omit<Helpee, 'member'|'queue'> & {
        displayName: string,
        memberId: string
    }>;
    name: string;
    parentCategoryId: string;
};

type ServerBackup = {
    serverName: string;
    timeStamp: Date;
    queues: QueueBackup[];
    afterSessionMessage: string;
    loggingChannel: string;
}

export { QueueBackup, ServerBackup };