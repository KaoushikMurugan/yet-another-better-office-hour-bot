import { Collection, GuildMember } from 'discord.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server';
import { HelpQueueV2 } from '../help-queue/help-queue';
import { Helpee, Helper } from '../models/member-states';


/**
 * Any class that implements this interface should visit server/queues to collect their stats
 * ----
 * [Visitor Pattern](https://refactoring.guru/design-patterns/visitor)
 * @usage 
 * - create an instance on server/queue creation and make it readonly
 * - then call collect when a collection is necessary; 
 *     - this updates the internal state of the collector
 * - call export in appropriate events
*/
interface StatisticsCollector {
    exportStats: (clearSnapshot?: boolean) => void;
}

type AttendanceEntry = {
    helperUsername: string;
    helperDiscordId: string;
    timeIn: Date;
    timeOut: Date;
    helpedMembers: GuildMember[];
    /**
     * Time when the most recent student joins the VC
     * ----
     * - resets to unefined after they leave
    */
    latestStudentJoinVCTimestamp?: Date;
    /**
     * Time spent helping the student in the VC
     * ----
     * - starts at 0, increments when a student leaves
     * - based on new Date() - lastStudentJoinVCTimeStamp
     */
    activeTimeMs: number;
    // // maybe remove these for the model, compute when export() is called
    // sessionTimeMs: number; // time out - time in, actual attendace
    // numStudentsHelped: number // helpedStudents.length
}

type HelpSessionEntry = {
    studentUsername: string;
    studentDiscordId: string;
    helperUsername: string;
    helperDiscordId: string;
    sessionStart: string;  // time join VC
    sessionEnd: string;  // time leave VC
    waitStart: string; // Helpee.waitStart
    queueName: string;
    waitTimeMs: number; // wait end - wait start
    sessionTimeMs: number // session end - session start
}

class ServerStatsCollector implements StatisticsCollector {

    /**
     * maintain a snapshot of the server here
     * 
    */

    // key is helper.member.id
    private attendanceStats: Collection<string, AttendanceEntry[]> = new Collection();
    private helpSessionStats: Collection<string, HelpSessionEntry[]> = new Collection();

    collectAttendanceStats(helper: Required<Helper>): void {
        return;
    }

    exportStats(clearSnapshot = false): AttendanceEntry[] {
        const attendanceEntries = [...this.attendanceStats.values()].flat();
        if (clearSnapshot) {
            this.attendanceStats.clear();
            this.helpSessionStats.clear();
        }
        return attendanceEntries;
    }
}

class QueueStatsCollector implements StatisticsCollector {


    // static reducer here

    collectQueueStats(queue: HelpQueueV2): void {
        return;
    }
    exportStats(clearSnapshot = false): void {
        return;
    }
}


export { StatisticsCollector, ServerStatsCollector, QueueStatsCollector };