import { SlashCommandBuilder } from 'discord.js';
import { ActivityTrackingCommandNames } from './interaction-names.js';

const dumpTrackingData = new SlashCommandBuilder()
    .setName(ActivityTrackingCommandNames.dump_tracking_data)
    .setDescription('Compile all tracking data into a single csv file');

const activityTrackingSlashCommands = [dumpTrackingData.toJSON()];

export { activityTrackingSlashCommands };
