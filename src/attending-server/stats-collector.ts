import { Collection } from 'discord.js';
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

type AttendanceEntry = Helper & {
    latestStudentJoinTimeStamp?: Date;
    activeTimeMs: number;
    complete: boolean;
}

// per [helper, student] pair
// created when a student joins vc
type HelpSessionEntry = {
    studentUsername: string;
    studentDiscordId: string;
    helperUsername: string;
    helperDiscordId: string;
    sessionStart: Date;  // time join VC
    sessionEnd?: Date;  // time leave VC
    waitStart: Date; // Helpee.waitStart
    queueName: string;
    waitTimeMs: number; // wait end - wait start
}

class ServerStatsCollector {

    // key is helper member.id
    private attendanceStats: Collection<string, AttendanceEntry> = new Collection();
    // key is student member.id
    private helpSessionStats: Collection<string, HelpSessionEntry[]> = new Collection();

    collectOnStudentsJoinVC(
        helpers: Collection<string, Helper>,
        students: Collection<string, Helpee>
    ): void {
        for (const [studentId, student] of students) {
            for (const [helperId, helper] of helpers) {
                const helpSessionEntry: HelpSessionEntry = {
                    studentUsername: student.member.user.username,
                    studentDiscordId: studentId,
                    helperUsername: helper.member.user.username,
                    helperDiscordId: helperId,
                    sessionStart: new Date(),
                    sessionEnd: undefined,
                    waitStart: student.waitStart,
                    queueName: student.queue.name,
                    waitTimeMs: (new Date()).getTime() - student.waitStart.getTime(),
                };
                this.helpSessionStats.has(studentId)
                    ? this.helpSessionStats.get(studentId)?.push(helpSessionEntry)
                    : this.helpSessionStats.set(studentId, [helpSessionEntry]);
                if (this.attendanceStats.has(helperId)) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    this.attendanceStats.get(helperId)!.latestStudentJoinTimeStamp = new Date();
                }
            }
        }
    }

    collectOnStudentsLeaveVC(studentMemberIds: string[]): void {
        studentMemberIds.forEach(studentId =>
            this.helpSessionStats.get(studentId)
                ?.filter(sessionStat => sessionStat.sessionEnd === undefined)
                .forEach(incompleteSession => incompleteSession.sessionEnd = new Date())
        );
        this.attendanceStats
            .forEach(entry => {
                if (entry.latestStudentJoinTimeStamp !== undefined) {
                    entry.activeTimeMs += (new Date()).getTime() -
                        entry.latestStudentJoinTimeStamp?.getTime();
                }
            });
    }

    collectOnHelperStart(helper: Helper): void {
        const attendanceEntry: AttendanceEntry = {
            ...helper,
            activeTimeMs: 0,
            complete: false
        };
        this.attendanceStats.set(helper.member.id, attendanceEntry);
    }

    collectOnHelperStop(helper: Required<Helper>): void {
        // ts doesn't know that map.has checks for existence
        // hence the non-null-assertion
        if (this.attendanceStats.has(helper.member.id)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.attendanceStats.get(helper.member.id)!.helpEnd = helper.helpEnd;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.attendanceStats.get(helper.member.id)!.complete = true;
        }
    }

    exportAttendanceStats(helperId: string): Required<AttendanceEntry> | undefined {
        if (!this.attendanceStats.has(helperId) || !this.attendanceStats.get(helperId)?.complete) {
            return undefined;
        }
        const attendanceEntries = this.attendanceStats.get(helperId);
        this.attendanceStats.delete(helperId);
        return attendanceEntries as Required<AttendanceEntry>;
    }
}

export { StatisticsCollector, ServerStatsCollector, AttendanceEntry, HelpSessionEntry };