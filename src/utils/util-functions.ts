/**
 * Converts the time delta in miliseconds into a readable format
 * ----
 * @param timeDiffInMs the difference to convert
*/
function msToHourMins(timeDiffInMs: number): string {
    const totalSeconds = Math.round(Math.abs(timeDiffInMs) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    return (hours > 0
        ? `${hours} hours and ${((totalSeconds - hours * 3600) / 60).toFixed(2)} minutes`
        : `${(totalSeconds / 60).toFixed(2)} minutes`);
}

export { msToHourMins };
