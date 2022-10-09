import { AutoClearTimeout } from '../help-queue/help-queue';
import { Helpee } from './member-states';

type QueueBackup = {
  studentsInQueue: ReadonlyArray<
    Omit<Helpee, 'member' | 'queue'> & {
      displayName: string;
      memberId: string;
    }
  >;
  name: string;
  parentCategoryId: string;
};

type ServerBackup = {
  serverName: string;
  timeStamp: Date;
  queues: QueueBackup[];
  afterSessionMessage: string;
  loggingChannelId: string;
  hoursUntilAutoClear: AutoClearTimeout;
};

export { QueueBackup, ServerBackup };
