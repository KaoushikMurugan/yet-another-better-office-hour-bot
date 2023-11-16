import { ButtonInteraction } from 'discord.js';
import { ButtonHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { CalendarButtonNames } from '../calendar-constants/calendar-interaction-names.js';
import { CalendarSettingsModal } from '../calendar-constants/calendar-modal-objects.js';
import { CalendarSettingsConfigMenu } from '../calendar-constants/calendar-settings-menu.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from '../calendar-constants/calendar-success-messsages.js';
import { isFromQueueChannelWithParent } from '../../../interaction-handling/shared-validations.js';
import { CalendarExtensionState } from '../calendar-states.js';
import { AttendingServerV2 } from '../../../attending-server/base-attending-server.js';

const calendarButtonMap: ButtonHandlerProps = {
    guildMethodMap: {
        queue: { [CalendarButtonNames.Refresh]: requestCalendarRefresh },
        other: {
            [CalendarButtonNames.ResetCalendarSettings]: resetCalendarSettings,
            [CalendarButtonNames.ShowCalendarSettingsModal]: showCalendarSettingsModal
        }
    },
    dmMethodMap: {},
    skipProgressMessageButtons: new Set([
        CalendarButtonNames.ShowCalendarSettingsModal,
        CalendarButtonNames.ResetCalendarSettings
    ])
};

/**
 * Resets the calendar settings to the default specified in the environment
 * @param interaction
 */
async function resetCalendarSettings(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const state = CalendarExtensionState.get(interaction.guildId);
    const server = AttendingServerV2.get(interaction.guildId);
    await Promise.all([
        state.setCalendarId(process.env.DEFAULT_CALENDAR_ID),
        server.sendLogMessage(CalendarLogMessages.backedUpToFirebase)
    ]);
    await interaction.update(
        CalendarSettingsConfigMenu(
            server,
            interaction.channelId,
            false,
            'Successfully reset all calendar settings.'
        )
    );
}

/**
 * Refreshes the calendar embed for the specified queue
 * @param queueName
 * @param interaction
 */
async function requestCalendarRefresh(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const state = CalendarExtensionState.get(interaction.guildId);
    const queueName = isFromQueueChannelWithParent(interaction).queueName;
    await state.refreshCalendarEvents();
    await state.emitStateChangeEvent(queueName);
    await interaction.editReply(CalendarSuccessMessages.refreshSuccess(queueName));
}

/**
 * Prompts the calendar settings modal
 * @remark follow up to a menu button
 * @param interaction
 */
async function showCalendarSettingsModal(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    await interaction.showModal(CalendarSettingsModal(interaction.guildId, true));
}

export { calendarButtonMap };
