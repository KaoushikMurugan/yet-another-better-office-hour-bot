// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { ChatInputCommandInteraction, EmbedBuilder, Guild, User } from 'discord.js';
import { CommandHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { SimpleEmbed, EmbedColor } from '../../../utils/embed-helper.js';
import { Optional } from '../../../utils/type-aliases.js';
import { GoogleSheetCommandNames } from '../google-sheet-constants/google-sheet-interaction-names.js';
import { ExpectedSheetErrors } from '../google-sheet-constants/expected-sheet-errors.js';
import { AttendingServerV2 } from '../../../attending-server/base-attending-server.js';
import { GoogleSheetExtensionState } from '../google-sheet-states.js';
import { camelCaseToTitleCase, convertMsToTime } from '../../../utils/util-functions.js';

/**
 * Statistics for both server help sessions and helper attendance
 * - Everything under `time` is a unix timestamp in ms
 */
type HelpSessionStats = {
    /**
     * Numerical values in this sections is formatted with  {@link convertMsToTime}
     */
    time: {
        /**
         * Sum of all session durations
         */
        totalSessionTime: number;
        /**
         * Sum of wait time of all students
         */
        totalWaitTime: number;
        /**
         * totalWaitTime / numSessions
         */
        averageWaitTime: number;
        /**
         * totalSessionTime / numSessions
         */
        averageSessionTime: number;
    };
    /**
     * Numerical values here are positive integers and are printed raw
     */
    count: {
        /**
         * Number of unique students
         */
        uniqueStudents: number;
        /**
         * Number of students that have visited more than once
         */
        returningStudents: number;
        /**
         * Number of sessions
         */
        sessions: number;
    };
};

const googleSheetCommandMap: CommandHandlerProps = {
    methodMap: {
        [GoogleSheetCommandNames.stats]: stats,
        [GoogleSheetCommandNames.weekly_report]: getWeeklyReport
    },
    skipProgressMessageCommands: new Set()
};

/**
 * /stats handler
 * @param interaction
 */
async function stats(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const timeFrame = (interaction.options.getString('time_frame') ?? 'all-time') as
        | 'all_time'
        | 'past_month'
        | 'past_week';
    const helper =
        interaction.options.getSubcommand() === 'helper'
            ? interaction.options.getUser('user') ?? interaction.user
            : undefined;
    const stats = await getStatistics(interaction.guild, timeFrame, helper);
    const embed = new EmbedBuilder()
        .setTitle(
            `Help session statistics for ${helper?.username ?? interaction.guild.name}`
        )
        .setColor(EmbedColor.Success)
        .setDescription(
            `\`\`\`${new AsciiTable3()
                .setAlign(1, AlignmentEnum.CENTER)
                .setAlign(2, AlignmentEnum.CENTER)
                .setStyle('unicode-single')
                .addRowMatrix([
                    ...Object.entries(stats.time).map(([key, value]) => [
                        camelCaseToTitleCase(key),
                        convertMsToTime(value)
                    ]),
                    ...Object.entries(stats.count).map(([key, value]) => [
                        camelCaseToTitleCase(key),
                        value
                    ])
                ])
                .toString()}\`\`\``
        )
        .setFooter({
            text: 'All time values are in the format HH:MM:SS'
        });
    await interaction.editReply({ embeds: [embed.data] });
}

/**
 * Computes the help session statistics for either server or helper
 * @param guild
 * @param timeFrame
 * @param helper
 * @returns
 */
async function getStatistics(
    guild: Guild,
    timeFrame: 'all_time' | 'past_month' | 'past_week',
    helper?: User
): Promise<HelpSessionStats> {
    const title = `${guild.name.replace(/:/g, ' ')} Help Sessions`.replace(
        /\s{2,}/g,
        ' '
    );
    const rows = await GoogleSheetExtensionState.get(guild.id).googleSheet.sheetsByTitle[
        title
    ]?.getRows();
    if (rows === undefined) {
        throw ExpectedSheetErrors.missingSheet('Help Session');
    }
    // object to hold results for the imperative for loop
    const runningResult = {
        totalSessionTime: 0,
        uniqueStudentIds: new Set(),
        returningStudents: 0,
        totalWaitTime: 0,
        numStudentsHelped: 0,
        sessions: 0
    };
    const timeFilter = getTimeFilter(timeFrame);
    for (const row of rows) {
        // if helper is specified, only look for rows that has this helper's id
        if (helper !== undefined && row['Helper Discord ID'] !== helper.id) {
            continue;
        }
        // now we are in a row that we are interested in
        // whether it's for server or helper doesn't matter anymore
        const [start, end, waitTime] = [
            parseInt(row['Session Start (Unix Timestamp)']),
            parseInt(row['Session End (Unix Timestamp)']),
            parseInt(row['Wait Time (ms)'])
        ];
        if (isNaN(start) || isNaN(end) || isNaN(waitTime)) {
            throw new Error('Some numerical values are damaged.');
        }
        // skip if outside time frame
        if (start < timeFilter) {
            continue;
        }
        runningResult.totalSessionTime += end - start;
        runningResult.returningStudents += runningResult.uniqueStudentIds.has(
            row['Student Discord ID']
        )
            ? 1
            : 0;
        runningResult.totalWaitTime += waitTime;
        runningResult.uniqueStudentIds.add(row['Student Discord ID']);
        runningResult.sessions += 1;
    }
    const finalResult: HelpSessionStats = {
        time: {
            totalSessionTime: runningResult.totalSessionTime,
            totalWaitTime: runningResult.totalWaitTime,
            averageWaitTime: Math.floor(runningResult.totalWaitTime / rows.length),
            averageSessionTime: Math.floor(runningResult.totalSessionTime / rows.length)
        },
        count: {
            uniqueStudents: runningResult.uniqueStudentIds.size,
            returningStudents: runningResult.returningStudents,
            sessions: runningResult.sessions
        }
    };
    return finalResult;
}

/**
 * The `/weekly_report` command
 * Prints a report of the help sessions for the past 'n' weeks
 * Weeks start on Monday
 * Stats include:
 * - Number of help sessions
 * - Total session time
 * - Number of students helped
 */
async function getWeeklyReport(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    // get the doc for this server
    const server = AttendingServerV2.get(interaction.guildId);
    const googleSheet = GoogleSheetExtensionState.get(interaction.guildId).googleSheet;

    // see the comment in getStatistics
    const sheetTitle = `${server.guild.name.replace(/:/g, ' ')} Attendance`.replace(
        /\s{2,}/g,
        ' '
    );

    const attendanceSheet = googleSheet.sheetsByTitle[sheetTitle];

    if (!attendanceSheet) {
        throw new Error(
            `No help session sheet found for server ${server.guild.name}. ` +
                `Did you forget to set the google sheet id in the environment?`
        );
    }

    const commandType = interaction.options.getSubcommand();

    const numWeeks = interaction.options.getInteger('num_weeks') ?? 1;

    let user: Optional<User> = undefined;

    if (commandType === 'server') {
        // do nothing
    } else if (commandType === 'helper') {
        user = interaction.options.getUser('user') ?? interaction.user;
    } else {
        throw new Error(`Invalid command type ${commandType}`);
    }

    const rows = await attendanceSheet.getRows();

    let filteredRows = rows.filter(row => {
        return user ? row['Discord ID'] === user.id : true;
    });

    const startTime = new Date();

    const startOfWeek = 1; // 0 = Sunday, 1 = Monday, etc.

    // set start time to the 'num_week'th monday before current time
    startTime.setDate(
        startTime.getDate() - (startTime.getDay() % 7) + startOfWeek - 7 * numWeeks
    );

    try {
        filteredRows = filteredRows.filter(row => {
            // the row 'Time In' is in the format 'MM/DD/YYYY, HH:MM:SS AM/PM'
            // TODO: add validation to indexing rows
            const returnDate = row['Time In'].split(',')[0]; // this could be undefined invoking split on undefined will throw exception
            const returnTime = row['Time In'].split(',')[1]; // this could be undefined
            const returnDateParts = returnDate.split('/');
            const returnTimeParts = returnTime.split(':');
            const returnDateObj = new Date(
                // FIXME: all of this could be NaN
                parseInt(returnDateParts[2]),
                parseInt(returnDateParts[0]) - 1,
                parseInt(returnDateParts[1]),
                parseInt(returnTimeParts[0]),
                parseInt(returnTimeParts[1]),
                parseInt(returnTimeParts[2].split(' ')[0])
            );
            // Date constructor never throws exception, but returns the "Invalid Date" string instead
            // need to be manually checked, TS design limitation here
            if (!(returnDateObj instanceof Date)) {
                // TODO: Temporary solution, if any parsing fails, throw this error instead
                throw ExpectedSheetErrors.unparsableDateString(attendanceSheet.title);
            }
            return returnDateObj >= startTime;
        });
    } catch {
        // TODO: Temporary solution, if any parsing fails, throw this error instead
        throw ExpectedSheetErrors.unparsableDateString(attendanceSheet.title);
    }

    if (filteredRows.length === 0) {
        await interaction.editReply(
            SimpleEmbed(
                `No help sessions found for ${
                    user?.username ?? server.guild.name
                } in the last ${numWeeks} week(s)`,
                EmbedColor.Neutral
            )
        );
    }

    // for each week, get the number of sessions, total time, and number of students helped
    const weeklyStats: {
        week: number;
        sessions: number;
        time: number;
        students: number;
    }[] = [];

    for (let i = 0; i < numWeeks; i++) {
        const weekStartTime = new Date(startTime);
        weekStartTime.setDate(weekStartTime.getDate() + 7 * i);

        const weekEndTime = new Date(startTime);
        weekEndTime.setDate(weekEndTime.getDate() + 7 * (i + 1));
        const weekRows = filteredRows.filter(row => {
            // the row 'Time In' is in the format 'MM/DD/YYYY, HH:MM:SS AM/PM'
            // TODO: remove excessive optional chaining
            const returnDate = row['Time In']?.split(',')[0];
            const returnTime = row['Time In']?.split(',')[1];
            const returnDateParts = returnDate?.split('/');
            const returnTimeParts = returnTime?.split(':');
            const returnDateObj = new Date(
                // FIXME: All of this could be NaN
                parseInt(returnDateParts[2]),
                parseInt(returnDateParts[0]) - 1,
                parseInt(returnDateParts[1]),
                parseInt(returnTimeParts[0]),
                parseInt(returnTimeParts[1]),
                parseInt(returnTimeParts[2].split(' ')[0])
            ); //TODO: remove manual parsing

            // need to be manually checked
            if (!(returnDateObj instanceof Date)) {
                throw ExpectedSheetErrors.unparsableDateString(attendanceSheet.title);
            }

            return returnDateObj >= weekStartTime && returnDateObj <= weekEndTime;
        });
        const weekSessions = weekRows.length;

        const weekTime = weekRows
            .map(row => {
                return parseInt(row['Session Time (ms)']);
            })
            .filter((time: number) => !isNaN(time))
            .reduce((a, b) => a + b, 0);

        const weekStudents = weekRows
            .map(row => {
                return parseInt(row['Number of Students Helped']);
            })
            .filter((num: number) => !isNaN(num))
            .reduce((a, b) => a + b, 0);

        weeklyStats.push({
            week: i + 1,
            sessions: weekSessions,
            time: weekTime,
            students: weekStudents
        });
    }

    const weeklyStatsString = weeklyStats
        .map(
            stat =>
                `Week of ${new Date(
                    startTime.getTime() + 7 * 24 * 60 * 60 * 1000 * (stat.week - 1)
                ).toLocaleDateString('en-UK', { month: 'short', day: '2-digit' })}` +
                `: **${stat.sessions}** sessions, **${
                    stat.students
                }** students, **${Math.floor(stat.time / 1000 / 60)}** minutes`
        )
        .join('\n');

    await interaction.editReply(
        SimpleEmbed(
            `Help sessions for ${
                user?.username ?? server.guild.name
            } in the last ${numWeeks} week(s):`,
            EmbedColor.Neutral,
            weeklyStatsString
        )
    );
}

/**
 * Returns a unix timestamp that is the lower bound of the specified time frame
 * @param timeFrame size of the time frame
 * @param basis what's the upper bound of the time frame. Defaults to today
 */
function getTimeFilter(
    timeFrame: 'all_time' | 'past_month' | 'past_week',
    basis = new Date()
): number {
    if (timeFrame === 'past_week') {
        return basis.getTime() - 7 * 24 * 60 * 60 * 1000;
    }
    if (timeFrame === 'past_month') {
        // assuming 30 days for simplicity
        return basis.getTime() - 30 * 24 * 60 * 60 * 1000;
    }
    return 0; // unix timestamp 0 catches all possible dates
}

export { googleSheetCommandMap };
