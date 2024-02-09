import { ChatInputCommandInteraction } from 'discord.js';
import { CommandHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { ActivityTrackingCommandNames } from '../constants/interaction-names.js';
import { firebaseTrackingDb } from '../datastore/firebase-impl.js';
import { json2csv } from 'json-2-csv';
import fs from 'fs/promises';
import { ATTENDANCE_LOGGER } from '../shared-functions.js';
import { SimpleEmbed } from '../../../utils/embed-helper.js';
import { ExpectedActivityTrackingErrors } from '../constants/expected-errors.js';

const activityTrackingCommandMap: CommandHandlerProps = {
    methodMap: {
        [ActivityTrackingCommandNames.dump_tracking_data]: dumpTrackingData
    },
    skipProgressMessageCommands: new Set()
};

async function dumpTrackingData(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const guild = interaction.guild;
    const [attendanceData, helpSessionData] = await Promise.all([
        firebaseTrackingDb.readAttendance(guild),
        firebaseTrackingDb.readHelpSessions(guild)
    ]);

    try {
        await fs.writeFile('./attendance.csv', json2csv(attendanceData));
        await fs.writeFile('./helpSessions.csv', json2csv(helpSessionData));

        await interaction.editReply({
            embeds: SimpleEmbed('Done!').embeds,
            files: ['./attendance.csv', './helpSessions.csv']
        });
    } catch {
        throw ExpectedActivityTrackingErrors.cannotWriteFile;
    }

    Promise.all([fs.unlink('./attendance.csv'), fs.unlink('./helpSessions.csv')])
        .then(() => ATTENDANCE_LOGGER.info('Successfully deleted all temporary csv files'))
        .catch(err =>
            ATTENDANCE_LOGGER.error(err, 'Failed to delete temporary csv files')
        );
}

export { activityTrackingCommandMap };
