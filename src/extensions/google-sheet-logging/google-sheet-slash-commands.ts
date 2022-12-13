import { SlashCommandBuilder } from 'discord.js';

// `/get_statistics`
const getStatistics = new SlashCommandBuilder()
    .setName('stats')
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
        )

const googleSheetsCommands = [getStatistics.toJSON()];

export { googleSheetsCommands };
