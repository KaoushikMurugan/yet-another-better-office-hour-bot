import { SlashCommandBuilder } from 'discord.js';

// `/get_statistics`
const getStatistics = new SlashCommandBuilder()
    .setName('get_statistics')
    .setDescription('Tutors only: Get your statistics from the past week.')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The user to get the statistics for')
            .setRequired(false)
    );

const googleSheetsCommands = [getStatistics.toJSON()];

export { googleSheetsCommands };
