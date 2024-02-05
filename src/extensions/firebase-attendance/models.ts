import { z } from 'zod';

/**
 * Additional attendance info for each helper
 */
type ActiveTime = {
    latestStudentJoinTimeStamp?: Date;
    activeTimeMs: number;
};

const attendanceEntrySchema = z.object({
    activeTimeMs: z.number(),
    helper: z.object({
        displayName: z.string(),
        id: z.string()
    }),
    helpStartUnixMs: z.number(),
    helpEndUnixMs: z.number(),
    helpedMembers: z.array(
        z.object({
            displayName: z.string(),
            id: z.string()
        })
    )
});

const helpSessionEntrySchema = z.object({
    studentUsername: z.string(),
    studentDiscordId: z.string(),
    helperUsername: z.string(),
    helperDiscordId: z.string(),
    sessionStartUnixMs: z.number(), // time join VC
    sessionEndUnixMs: z.number(), // time leave VC
    waitStart: z.number(), // Helpee.waitStart
    queueName: z.string(),
    waitTimeMs: z.number() // wait end - wait start
});

const attendanceDocumentSchema = z.object({
    entries: z.array(attendanceEntrySchema)
});
const helpSessionDocumentSchema = z.object({
    entries: z.array(helpSessionEntrySchema)
});

/**
 * 1 Attendance entry of 1 helper
 */
type AttendanceEntry = z.infer<typeof attendanceEntrySchema>;

type HelpSessionEntry = z.infer<typeof helpSessionEntrySchema>;

type PartialHelpSessionEntry = Omit<HelpSessionEntry, 'sessionEndUnixMs'>;

export {
    AttendanceEntry,
    HelpSessionEntry,
    PartialHelpSessionEntry,
    ActiveTime,
    helpSessionDocumentSchema,
    attendanceDocumentSchema
};
