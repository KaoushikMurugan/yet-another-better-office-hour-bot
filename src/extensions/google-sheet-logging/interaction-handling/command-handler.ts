import { ChatInputCommandInteraction, User } from 'discord.js';
import { CommandHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { isServerInteraction } from '../../../interaction-handling/shared-validations.js';
import { SimpleEmbed, EmbedColor } from '../../../utils/embed-helper.js';
import { Optional } from '../../../utils/type-aliases.js';
import { GoogleSheetCommands } from '../google-sheet-constants/google-sheet-interaction-names.js';
import {
    getServerGoogleSheet,
    isServerGoogleSheetInteraction
} from '../shared-sheet-functions.js';
import { GoogleSheetSuccessMessages } from '../google-sheet-constants/sheet-success-messages.js';

const googleSheetCommandMap: CommandHandlerProps = {
    methodMap: {
        [GoogleSheetCommands.stats]: getStatistics,
        [GoogleSheetCommands.weekly_report]: getWeeklyReport,
        [GoogleSheetCommands.set_google_sheet]: setGoogleSheet
    },
    skipProgressMessageCommands: new Set()
};

/**
 * The `/stats` command
 * Prints out the following statistics for the server
 * - Total number of help sessions
 * - Total session time
 * - Total number of students sessions helped
 * - Number of unique students helped
 * - Total number of returning students
 * - Average Session Time
 */
async function getStatistics(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    // get the doc for this server
    const server = isServerInteraction(interaction);
    const googleSheet = getServerGoogleSheet(server);
    if (!googleSheet) {
        throw new Error(
            `No google sheet found for server ${server.guild.name}. ` +
                `Did you forget to set the google sheet id?`
        );
    }

    const attendanceSheetTitle = `${server.guild.name.replace(/:/g, ' ')} Attendance`.replace(
        /\s{2,}/g,
        ' '
    );

    const attendanceSheet = googleSheet.sheetsByTitle[attendanceSheetTitle];

    if (!attendanceSheet) {
        throw new Error(
            `No attendance sheet found for server ${server.guild.name}. ` +
                `Did you forget to set the google sheet id`
        );
    }

    const commandType = interaction.options.getSubcommand();

    let user: Optional<User> = undefined;

    if (commandType === 'server') {
        // do nothing
    } else if (commandType === 'helper') {
        user = interaction.options.getUser('helper') ?? interaction.user;
    } else {
        throw new Error(`Invalid command type ${commandType}`);
    }

    const timeFrame = interaction.options.getString('time_frame') ?? 'all-time';

    const attendanceRows = await attendanceSheet.getRows();

    let filteredAttendanceRows = attendanceRows.filter(row => {
        return user ? row['Discord ID'] === user.id : true;
    });

    const startTime = new Date();

    if (timeFrame === 'past_week') {
        startTime.setDate(startTime.getDate() - 7);
    } else if (timeFrame === 'past_month') {
        startTime.setMonth(startTime.getMonth() - 1);
    } else if (timeFrame === 'all_time') {
        // set to 0 unix time
        startTime.setTime(0);
    }

    filteredAttendanceRows = filteredAttendanceRows.filter(row => {
        // the row 'Time In' is in the format 'MM/DD/YYYY, HH:MM:SS AM/PM'
        const returnDate = row['Time In'].split(',')[0];
        const returnTime = row['Time In'].split(',')[1];
        const returnDateParts = returnDate.split('/');
        const returnTimeParts = returnTime.split(':');
        const returnDateObj = new Date(
            parseInt(returnDateParts[2]),
            parseInt(returnDateParts[0]) - 1,
            parseInt(returnDateParts[1]),
            parseInt(returnTimeParts[0]),
            parseInt(returnTimeParts[1]),
            parseInt(returnTimeParts[2].split(' ')[0])
        );

        return returnDateObj >= startTime;
    });

    if (filteredAttendanceRows.length === 0) {
        await interaction.editReply(
            SimpleEmbed(
                `No help sessions found for ${user?.username ?? server.guild.name}`,
                EmbedColor.Neutral
            )
        );
    }

    const helperSessionCount = filteredAttendanceRows.length;

    const totalAvailableTime = filteredAttendanceRows
    .map(row => {
            return parseInt(row['Session Time (ms)']);
        })
        .filter((time: number) => !isNaN(time))
        .reduce((a, b) => a + b, 0);


    const totalAvailableTimeHours = Math.trunc(totalAvailableTime / (1000 * 60 * 60));
    const totalAvailableTimeMinutes = Math.trunc(totalAvailableTime / (1000 * 60)) % 60;

    const numberOfStudents = filteredAttendanceRows
        .map(row => {
            return parseInt(row['Number of Students Helped']);
        })
        .filter((num: number) => !isNaN(num))
        .reduce((a, b) => a + b, 0);

    const studentsList: string[] = [];

    // each cell in the 'Helped Student' is an arry of json strings, where the json is of the form
    // {displayName: string, username: string, id: string}
    filteredAttendanceRows.forEach(row => {
        const students = row['Helped Students'];
        if (students) {
            const studentArray = JSON.parse(students);
            studentArray.forEach((student: { id: string }) => {
                studentsList.push(student.id);
            });
        }
    });

    const uniqueStudents = new Set(studentsList);

    // count students who were helped multiple times
    const returningStudents = new Set(
        studentsList.filter((student, index) => studentsList.indexOf(student) !== index)
    );

    //   --------------------------
    //   Reading Help Session Sheet
    //   --------------------------

    
    const helpSessionSheetTitle = `${server.guild.name.replace(/:/g, ' ')} Help Sessions`.replace(
        /\s{2,}/g,
        ' '
    );

    const helpSessionSheet = googleSheet.sheetsByTitle[helpSessionSheetTitle];

    if (!helpSessionSheet) {
        throw new Error(
            `No help session sheet found for server ${server.guild.name}. ` +
                `Did you forget to set the google sheet id?`
        );
    }

    const helpSessionRows = await helpSessionSheet.getRows();

    let filteredHelpSessionRows = helpSessionRows.filter(row => {
        return user ? row['Helper Discord ID'] === user.id : true;
    });

    filteredHelpSessionRows = filteredHelpSessionRows.filter(row => {
        // the row 'Session Start' is in the format 'MM/DD/YYYY, HH:MM:SS AM/PM'
        const returnDate = row['Session Start'].split(',')[0];
        const returnTime = row['Session Start'].split(',')[1];
        const returnDateParts = returnDate.split('/');
        const returnTimeParts = returnTime.split(':');
        const returnDateObj = new Date(
            parseInt(returnDateParts[2]),
            parseInt(returnDateParts[0]) - 1,
            parseInt(returnDateParts[1]),
            parseInt(returnTimeParts[0]),
            parseInt(returnTimeParts[1]),
            parseInt(returnTimeParts[2].split(' ')[0])
        );

        return returnDateObj >= startTime;
    });

    if (filteredAttendanceRows.length === 0) {
        await interaction.editReply(
            SimpleEmbed(
                `No help sessions found for ${user?.username ?? server.guild.name}`,
                EmbedColor.Neutral
            )
        );
    }

    const helpSessionCount = filteredHelpSessionRows.length;

    const totalSessionTime = filteredHelpSessionRows
        .map(row => {
            return parseInt(row['Session Time (ms)']);
        })
        .filter((time: number) => !isNaN(time))
        .reduce((a, b) => a + b, 0);


    const totalSessionTimeHours = Math.trunc(totalSessionTime / (1000 * 60 * 60));
    const totalSessionTimeMinutes = Math.trunc(totalSessionTime / (1000 * 60)) % 60;

    const averageSessionTime = totalSessionTime / helpSessionCount;

    const averageSessionTimeHours = Math.trunc(averageSessionTime / (1000 * 60 * 60));
    const averageSessionTimeMinutes = Math.trunc(averageSessionTime / (1000 * 60)) % 60;

    const totalWaitTime = filteredHelpSessionRows
        .map(row => {
            return parseInt(row['Wait Time (ms)']);
        })
        .filter((time: number) => !isNaN(time))
        .reduce((a, b) => a + b, 0);

    const averageWaitTime = totalWaitTime / helpSessionCount;

    const averageWaitTimeHours = Math.trunc(averageWaitTime / (1000 * 60 * 60));
    const averageWaitTimeMinutes = Math.trunc(averageWaitTime / (1000 * 60)) % 60;

    const result = SimpleEmbed(
        `Help session statistics for ` + `${user ? user.username : server.guild.name}`,
        EmbedColor.Neutral,
        `Help sessions: **${helperSessionCount}**\n` +
            `Total available time: **${
                totalAvailableTimeHours > 0 ? `${totalAvailableTimeHours} h ` : ''
            }${totalAvailableTimeMinutes} min**\n` +
            `Total helping time: **${
                totalSessionTimeHours > 0 ? `${totalSessionTimeHours} h ` : ''
            }${totalSessionTimeMinutes} min**\n\n` +
            `Number of student sessions: **${numberOfStudents}**\n` +
            `Unique students helped: **${uniqueStudents.size}**\n` +
            `Returning students: **${returningStudents.size}**\n\n` +
            `Average session time: **${
                averageSessionTimeHours > 0 ? `${averageSessionTimeHours} h ` : ''
            }${averageSessionTimeMinutes} min**\n` +
            `Average wait time: **${
                averageWaitTimeHours > 0 ? `${averageWaitTimeHours} h ` : ''
            }${averageWaitTimeMinutes} min**\n`
    );
    await interaction.editReply(result);
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
    const server = isServerInteraction(interaction);
    const googleSheet = getServerGoogleSheet(server);
    if (!googleSheet) {
        throw new Error(
            `No google sheet found for server ${server.guild.name}. ` +
                `Did you forget to set the google sheet id in the environment?`
        );
    }

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
        user = interaction.options.getUser('helper') ?? interaction.user;
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

    filteredRows = filteredRows.filter(row => {
        // the row 'Time In' is in the format 'MM/DD/YYYY, HH:MM:SS AM/PM'
        const returnDate = row['Time In'].split(',')[0];
        const returnTime = row['Time In'].split(',')[1];
        const returnDateParts = returnDate.split('/');
        const returnTimeParts = returnTime.split(':');
        const returnDateObj = new Date(
            parseInt(returnDateParts[2]),
            parseInt(returnDateParts[0]) - 1,
            parseInt(returnDateParts[1]),
            parseInt(returnTimeParts[0]),
            parseInt(returnTimeParts[1]),
            parseInt(returnTimeParts[2].split(' ')[0])
        );

        return returnDateObj >= startTime;
    });

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
            const returnDate = row['Time In'].split(',')[0];
            const returnTime = row['Time In'].split(',')[1];
            const returnDateParts = returnDate.split('/');
            const returnTimeParts = returnTime.split(':');
            const returnDateObj = new Date(
                parseInt(returnDateParts[2]),
                parseInt(returnDateParts[0]) - 1,
                parseInt(returnDateParts[1]),
                parseInt(returnTimeParts[0]),
                parseInt(returnTimeParts[1]),
                parseInt(returnTimeParts[2].split(' ')[0])
            ); //TODO: remove manual parsing

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
 * Changes which google sheet to read from. The `/set_google_sheet` command
 */
async function setGoogleSheet(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const [state] = isServerGoogleSheetInteraction(interaction);
    const sheetId = interaction.options.getString('sheet_id', true).trim();
    await state.setGoogleSheet(sheetId);
    await interaction.editReply(
        GoogleSheetSuccessMessages.updatedGoogleSheet(state.googleSheet.title)
    );
}

export { googleSheetCommandMap };
