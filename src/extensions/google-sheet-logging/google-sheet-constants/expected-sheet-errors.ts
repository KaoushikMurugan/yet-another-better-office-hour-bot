/** @module ExpectedErrors */

class AttendanceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AttendanceError';
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

const ExpectedSheetErrors = {
    unknownEntry: new AttendanceError(
        "Failed to update attendace. YABOB doesn't recognize this entry."
    ),
    recordedButCannotUpdate: new AttendanceError(
        'Failed to update attendace. ' +
            'The attendance sheet might have missing headers or does not allow this YABOB to make changes.\n' +
            "Don't worry, your hours are still being logged, " +
            'just not viewable on Google Sheets. ' +
            'Please contact @Bot Admin to manually update.'
    )
} as const;

export { ExpectedSheetErrors };
