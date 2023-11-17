import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { ChatInputCommandInteraction, EmbedBuilder, Guild, User } from 'discord.js';
import { CommandHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { EmbedColor, SimpleEmbed } from '../../../utils/embed-helper.js';
import { GoogleSheetCommandNames } from '../google-sheet-constants/google-sheet-interaction-names.js';
import { ExpectedSheetErrors } from '../google-sheet-constants/expected-sheet-errors.js';
import { GoogleSheetExtensionState } from '../google-sheet-states.js';
import {
    camelCaseToTitleCase,
    convertMsToShortTime,
    range
} from '../../../utils/util-functions.js';
import {
    AttendanceHeaders,
    HelpSessionHeaders
} from '../google-sheet-constants/column-enums.js';

/**
 * Statistics for both server help sessions and helper attendance
 * - Everything under `time` is a unix timestamp in ms
 */
type HelpSessionStats = {
    /**
     * Numerical values in this sections is formatted with  {@link convertMsToShortTime}
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

/**
 * Represents the report of 1 week
 */
type WeeklyReport = {
    /**
     * Number of sessions
     */
    sessions: number;
    /**
     * Number of students
     */
    students: number;
    /**
     * Total time that the OH is open this week
     */
    totalTimeMs: number;
};

const googleSheetCommandMap: CommandHandlerProps = {
    methodMap: {
        [GoogleSheetCommandNames.stats]: stats,
        [GoogleSheetCommandNames.weekly_report]: weeklyReport
    },
    skipProgressMessageCommands: new Set()
};

/**
 * /stats handler
 * @param interaction
 */
async function stats(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
    const timeFrame = interaction.options.getString('time_frame', true) as
        | 'all_time'
        | 'past_month'
        | 'past_week'; // type is enforced in the slash command options
    const helper =
        interaction.options.getSubcommand() === 'helper'
            ? interaction.options.getUser('user') ?? interaction.user
            : undefined;
    const stats = await getStatistics(interaction.guild, timeFrame, helper);
    const table = new AsciiTable3()
        .setAlign(1, AlignmentEnum.CENTER)
        .setAlign(2, AlignmentEnum.CENTER)
        .setStyle('unicode-single')
        .addRowMatrix([
            // this assumes the shape of stats is exactly HelpSessionStats
            // if there are other fields it will create extra rows
            ...Object.entries(stats.time).map(([key, value]) => [
                camelCaseToTitleCase(key),
                convertMsToShortTime(value)
            ]),
            ...Object.entries(stats.count).map(([key, value]) => [
                camelCaseToTitleCase(key),
                value
            ])
        ])
        .toString();
    const embed = new EmbedBuilder()
        .setTitle(
            `Help session statistics for ${helper?.username ?? interaction.guild.name}`
        )
        .setColor(EmbedColor.Success)
        .setDescription(`\`\`\`${table}\`\`\``)
        .setFooter({
            text: 'All time values are in the format HH:MM:SS'
        });
    await interaction.editReply({ embeds: [embed.data] });
}

/**
 * Computes the help session statistics for either server or helper
 * @param guild
 * @param timeFrame
 * @param helper if specified, the statistics will be for this helper only
 * @returns HelpSessionStats
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
    const helpSessionRows = await GoogleSheetExtensionState.get(
        guild.id
    ).googleSheet.sheetsByTitle[title]?.getRows();
    if (helpSessionRows === undefined) {
        throw ExpectedSheetErrors.missingSheet('Help Session');
    }
    // object to accumulate results for the imperative for loop
    const buffer = {
        totalSessionTime: 0,
        uniqueStudentIds: new Set(),
        returningStudents: 0,
        totalWaitTime: 0,
        numStudentsHelped: 0,
        sessions: 0
    };
    const timeFilter = getTimeFilter(timeFrame);
    for (const row of helpSessionRows) {
        // if helper is specified, only look for rows that has this helper's id
        if (helper && row.get(HelpSessionHeaders.HelperDiscordId) !== helper.id) {
            continue;
        }
        // now we are in a row that we are interested in
        // whether it's for server or helper doesn't matter anymore
        const [start, end, waitTime] = [
            parseInt(row.get(HelpSessionHeaders.SessionStartUnix)),
            parseInt(row.get(HelpSessionHeaders.SessionEndUnix)),
            parseInt(row.get(HelpSessionHeaders.WaitTimeMs))
        ];
        if ([start, end, waitTime].some(val => isNaN(val) || val < 0)) {
            throw ExpectedSheetErrors.badNumericalValues(title);
        }
        if (start < timeFilter) {
            // skip if outside time frame
            continue;
        }
        buffer.totalSessionTime += end - start;
        buffer.returningStudents += buffer.uniqueStudentIds.has(
            row.get(HelpSessionHeaders.StudentDiscordId)
        )
            ? 1
            : 0;
        buffer.totalWaitTime += waitTime;
        buffer.uniqueStudentIds.add(row.get(HelpSessionHeaders.StudentDiscordId));
        buffer.sessions += 1;
    }
    return {
        time: {
            totalSessionTime: buffer.totalSessionTime,
            totalWaitTime: buffer.totalWaitTime,
            averageWaitTime: Math.floor(buffer.totalWaitTime / helpSessionRows.length),
            averageSessionTime: Math.floor(
                buffer.totalSessionTime / helpSessionRows.length
            )
        },
        count: {
            sessions: buffer.sessions,
            returningStudents: buffer.returningStudents,
            uniqueStudents: buffer.uniqueStudentIds.size
        }
    };
}

/**
 * Handles /weekly_report for both helper and server
 * @param interaction
 */
async function weeklyReport(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const helper =
        interaction.options.getSubcommand() === 'helper'
            ? interaction.options.getUser('user') ?? interaction.user
            : undefined;
    const reports = await getWeeklyReports(
        interaction.guild,
        Math.max(interaction.options.getInteger('num_weeks') ?? 1, 1),
        helper
    );
    if (reports.length === 0) {
        await interaction.editReply(
            SimpleEmbed(
                `There are no attendance entries for ${
                    helper?.username ?? interaction.guild.name
                }`
            )
        );
        return;
    }
    const table = new AsciiTable3()
        .setAlign(1, AlignmentEnum.CENTER)
        .setAlign(2, AlignmentEnum.CENTER)
        .setAlign(3, AlignmentEnum.CENTER)
        .setAlign(4, AlignmentEnum.CENTER)
        .setStyle('unicode-single')
        .setHeading('', 'Sessions', 'Students', 'Total Time')
        .addRowMatrix(
            reports.map(([week, report]) => [
                week,
                report.sessions,
                report.students,
                convertMsToShortTime(report.totalTimeMs)
            ])
        );
    const embed = new EmbedBuilder()
        .setTitle(`Weekly Reports for ${helper?.username ?? interaction.guild.name}`)
        .setColor(EmbedColor.Success)
        .setDescription(`\`\`\`${table.toString()}\`\`\``)
        .setFooter({
            text: 'All time values are in the format HH:MM:SS. Weeks with no entries are omitted.'
        });
    await interaction.editReply({ embeds: [embed.data] });
}

/**
 * Generate a list of weekly reports for server or helper
 * @param guild
 * @param numWeeks
 * @param helper
 * @returns
 */
async function getWeeklyReports(
    guild: Guild,
    numWeeks = 1,
    helper?: User
): Promise<[string, WeeklyReport][]> {
    const title = `${guild.name.replace(/:/g, ' ')} Attendance`.replace(/\s{2,}/g, ' ');
    const allRows = await GoogleSheetExtensionState.get(
        guild.id
    ).googleSheet.sheetsByTitle[title]?.getRows();
    if (allRows === undefined) {
        throw ExpectedSheetErrors.missingSheet('Attendance');
    }
    const rowsToSearch = helper
        ? allRows.filter(row => row.get(AttendanceHeaders.HelperDiscordId) === helper.id)
        : allRows;
    const msInWeek = 7 * 24 * 60 * 60 * 1000;
    const reports: [string, WeeklyReport][] = [];
    for (const week of range(numWeeks)) {
        const [weekStartUnix, weekEndUnix] = [
            new Date().getTime() - (week + 1) * msInWeek,
            new Date().getTime() - week * msInWeek
        ];
        const rowsInWeek = rowsToSearch
            .filter(row => {
                const [timeIn, timeOut] = [
                    parseInt(row.get(AttendanceHeaders.UnixTimeIn)),
                    parseInt(row.get(AttendanceHeaders.UnixTimeOut))
                ];
                if ([timeIn, timeOut].some(val => isNaN(val) || val < 0)) {
                    throw ExpectedSheetErrors.badNumericalValues(
                        title,
                        AttendanceHeaders.UnixTimeIn
                    );
                }
                return timeIn >= weekStartUnix && timeOut <= weekEndUnix;
            })
            .map(row => {
                const result = {
                    sessions: 1,
                    students: 0,
                    totalTimeMs: parseInt(row.get(AttendanceHeaders.OfficeHourTimeMs))
                };
                if (isNaN(result.totalTimeMs) || result.totalTimeMs < 0) {
                    throw ExpectedSheetErrors.badNumericalValues(
                        title,
                        AttendanceHeaders.OfficeHourTimeMs
                    );
                }
                try {
                    result.students = JSON.parse(
                        row.get(AttendanceHeaders.HelpedStudents)
                    )?.length;
                    if (typeof result.students !== 'number' || result.students < 0) {
                        // this error is unused, it's here just to skip to the catch block
                        throw Error('');
                    }
                } catch {
                    throw ExpectedSheetErrors.unparsableNonNumericData(
                        title,
                        AttendanceHeaders.HelpedStudents
                    );
                }
                return result;
            });
        if (rowsInWeek.length === 0) {
            continue;
        }
        reports.push([
            `Week of ${new Date(weekStartUnix).toLocaleDateString()}`,
            rowsInWeek.reduce((prev, curr) => ({
                sessions: prev.sessions + curr.sessions,
                students: prev.students + curr.students,
                totalTimeMs: prev.totalTimeMs + curr.totalTimeMs
            }))
        ]);
    }
    return reports;
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
