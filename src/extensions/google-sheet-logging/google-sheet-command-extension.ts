import { ChatInputCommandInteraction, Guild, User } from 'discord.js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { isServerInteraction } from '../../command-handling/common-validations.js';
import { CommandData } from '../../command-handling/command/slash-commands.js';
import { environment } from '../../environment/environment-manager.js';
import { red } from '../../utils/command-line-colors.js';
import {
    EmbedColor,
    ErrorEmbed,
    SimpleEmbed,
    SlashCommandLogEmbed
} from '../../utils/embed-helper.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { CommandCallback, Optional, YabobEmbed } from '../../utils/type-aliases.js';
import { logSlashCommand } from '../../utils/util-functions.js';
import {
    BaseInteractionExtension,
    IInteractionExtension
} from '../extension-interface.js';
import { getServerGoogleSheet } from './google-sheet-logging.js';
import { googleSheetsCommands } from './google-sheet-slash-commands.js';

class GoogleSheetInteractionExtension
    extends BaseInteractionExtension
    implements IInteractionExtension
{
    constructor() {
        super();
    }

    private static helpEmbedsSent = false;

    /**
     * Returns a new GoogleSheetLoggingExtension for the server with the given name
     * - Uses the google sheet id from the environment
     * @param guild
     * @throws ExtensionSetupError if
     * - the google sheet id is not set in the environment
     * - the google sheet id is invalid
     * - the google sheet is not accessible
     */
    static async load(guild: Guild): Promise<GoogleSheetInteractionExtension> {
        if (environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID.length === 0) {
            throw new ExtensionSetupError(
                'No Google Sheet ID or Google Cloud credentials found.'
            );
        }
        const googleSheet = new GoogleSpreadsheet(
            environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID
        );
        await googleSheet.useServiceAccountAuth(environment.googleCloudCredentials);
        await googleSheet.loadInfo().catch(() => {
            throw new ExtensionSetupError(
                red(
                    `Failed to load google sheet for ${guild.name}. ` +
                        `Google sheets rejected our connection.`
                )
            );
        });
        return new GoogleSheetInteractionExtension();
    }

    override get slashCommandData(): CommandData {
        return googleSheetsCommands;
    }

    override canHandleCommand(interaction: ChatInputCommandInteraction): boolean {
        return interaction.commandName in commandMethodMap;
    }

    override async processCommand(
        interaction: ChatInputCommandInteraction<'cached'>
    ): Promise<void> {
        //Send logs before* processing the command
        const server = isServerInteraction(interaction);
        await interaction.reply({
            ...SimpleEmbed(
                `Processing command \`${interaction.commandName}\` ...`,
                EmbedColor.Neutral
            ),
            ephemeral: true
        });
        server.sendLogMessage(SlashCommandLogEmbed(interaction));
        const commandMethod = commandMethodMap[interaction.commandName];
        logSlashCommand(interaction);
        await commandMethod?.(interaction)
            .then(successMessage => interaction.editReply(successMessage))
            .catch(async err =>
                interaction.replied
                    ? await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID))
                    : await interaction.reply({
                          ...ErrorEmbed(err, server.botAdminRoleID),
                          ephemeral: true
                      })
            );
    }
}

const commandMethodMap: { [commandName: string]: CommandCallback } = {
    stats: getStatistics,
    weekly_report: getWeeklyReport
};

/**
 * The `/stats` command
 * @param interaction
 * @returns
 */
async function getStatistics(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
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

    let user: Optional<User> = undefined;

    if (commandType === 'server') {
        // do nothing
    } else if (commandType === 'helper') {
        user = interaction.options.getUser('helper') ?? interaction.user;
    } else {
        throw new Error(`Invalid command type ${commandType}`);
    }

    const timeFrame = interaction.options.getString('time_frame') ?? 'all-time';

    const rows = await attendanceSheet.getRows();

    let filteredRows = rows.filter(row => {
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
        return SimpleEmbed(
            `No help sessions found for ${user?.username ?? server.guild.name}`,
            EmbedColor.Neutral
        );
    }

    const helpSessionCount = filteredRows.length;

    const totalSessionTime = filteredRows
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

    const numberOfStudents = filteredRows
        .map(row => {
            return parseInt(row['Number of Students Helped']);
        })
        .filter((num: number) => !isNaN(num))
        .reduce((a, b) => a + b, 0);

    let studentsList: string[] = [];

    // each cell in the 'Helped Student' is an arry of json strings, where the json is of the form
    // {displayName: string, username: string, id: string}
    filteredRows.forEach(row => {
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

    return SimpleEmbed(
        `Help session statistics for ` + `${user ? user.username : server.guild.name}`,
        EmbedColor.Neutral,
        `Help sessions: **${helpSessionCount}**\n` +
            `Total session time: **${
                totalSessionTimeHours > 0 ? `${totalSessionTimeHours} h ` : ''
            }${totalSessionTimeMinutes} min**\n` +
            `Number of students sessions: **${numberOfStudents}**\n` +
            `Unique students helped: **${uniqueStudents.size}**\n` +
            `Returning students: **${returningStudents.size}**\n` +
            `Average session time: **${
                averageSessionTimeHours > 0 ? `${averageSessionTimeHours} h ` : ''
            }${averageSessionTimeMinutes} min**\n`
    );
}

async function getWeeklyReport(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
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
        return SimpleEmbed(
            `No help sessions found for ${
                user?.username ?? server.guild.name
            } in the last ${numWeeks} week(s)`,
            EmbedColor.Neutral
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
            );

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

    return SimpleEmbed(
        `Help sessions for ${
            user?.username ?? server.guild.name
        } in the last ${numWeeks} week(s):`,
        EmbedColor.Neutral,
        weeklyStatsString
    );
}

export { GoogleSheetInteractionExtension };
