import { SlashCommandBuilder } from 'discord.js';
import { GoogleSheetCommands } from './google-sheet-interaction-names.js';

// `/get_statistics`
const getStatistics = new SlashCommandBuilder()
    .setName(GoogleSheetCommands.stats)
    .setDescription('Statistics')
    .addSubcommand(subcommand =>
        subcommand
            .setName('helper')
            .setDescription('Get statistics for a helper.')
            .addStringOption(option =>
                option
                    .setName('time_frame')
                    .setDescription('The type of statistics to get')
                    .setRequired(true)
                    .addChoices(
                        {
                            name: 'All Time',
                            value: 'all_time'
                        },
                        {
                            name: 'Past Month',
                            value: 'past_month'
                        },
                        {
                            name: 'Past Week',
                            value: 'past_week'
                        }
                    )
            )
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('The user to get the statistics for')
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('server')
            .setDescription('Get statistics for the server.')
            .addStringOption(option =>
                option
                    .setName('time_frame')
                    .setDescription('The type of statistics to get')
                    .setRequired(true)
                    .addChoices(
                        {
                            name: 'All Time',
                            value: 'all_time'
                        },
                        {
                            name: 'Past Month',
                            value: 'past_month'
                        },
                        {
                            name: 'Past Week',
                            value: 'past_week'
                        }
                    )
            )
    );

// `/weekly_report`
const weeklyReport = new SlashCommandBuilder()
    .setName(GoogleSheetCommands.weekly_report)
    .setDescription('Get a weekly report for the past `x` weeks.')
    .addSubcommand(subcommand =>
        subcommand
            .setName('helper')
            .setDescription('Get a weekly report for a helper.')
            .addIntegerOption(option =>
                option
                    .setName('num_weeks')
                    .setDescription('The number of weeks to get the report for')
                    .setRequired(true)
            )
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('The user to get the report for')
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('server')
            .setDescription('Get a weekly report for the server.')
            .addIntegerOption(option =>
                option
                    .setName('num_weeks')
                    .setDescription('The number of weeks to get the report for')
                    .setRequired(true)
            )
    );

const googleSheetsCommands = [getStatistics.toJSON(), weeklyReport.toJSON()];

export { googleSheetsCommands };
