import { ButtonInteraction } from 'discord.js';
import { AttendingServer } from '../../../attending-server/base-attending-server.js';
import { ButtonHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { ActivityTrackingButtonNames } from '../constants/interaction-names.js';
import { ActivityTrackingSettingsConfigMenu } from '../constants/settings-menu.js';
import { ActivityTrackingSuccessMessages } from '../constants/success-messages.js';

const activityTrackingButtonMap: ButtonHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [ActivityTrackingButtonNames.UpdateTrackingStatus]: updateTrackingStatus
        }
    },
    dmMethodMap: {},
    skipProgressMessageButtons: new Set([
        ActivityTrackingButtonNames.UpdateTrackingStatus
    ])
};

/**
 * Updates sheet tracking setting
 * @param interaction
 */
async function updateTrackingStatus(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const newTrackingStatus = !server.trackingEnabled;

    server.setTrackingEnabled(newTrackingStatus);
    server.sendLogMessage(
        ActivityTrackingSuccessMessages.updatedSheetTracking(newTrackingStatus)
    );

    await interaction.update(
        ActivityTrackingSettingsConfigMenu(
            server,
            false,
            `Successfully ${
                newTrackingStatus ? 'enabled' : 'disabled'
            } google sheet tracking.`
        )
    );
}

export { activityTrackingButtonMap };
