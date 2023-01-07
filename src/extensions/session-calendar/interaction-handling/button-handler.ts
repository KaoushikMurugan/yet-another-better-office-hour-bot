import { ButtonInteraction } from 'discord.js';
import { environment } from '../../../environment/environment-manager.js';
import { ButtonHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { CalendarButtonNames } from '../calendar-constants/calendar-interaction-names.js';
import { calendarSettingsModal } from '../calendar-constants/calendar-modal-objects.js';
import { CalendarSettingsConfigMenu } from '../calendar-constants/calendar-settings-menu.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from '../calendar-constants/calendar-success-messsages.js';
import { isServerCalendarInteraction } from '../shared-calendar-functions.js';
import { isFromQueueChannelWithParent } from '../../../interaction-handling/shared-validations.js';

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

async function resetCalendarSettings(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const [server, state] = isServerCalendarInteraction(interaction);
    await Promise.all([
        state.setCalendarId(environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID),
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
    const state = isServerCalendarInteraction(interaction)[1];
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
    const [server] = isServerCalendarInteraction(interaction);
    await interaction.showModal(calendarSettingsModal(server.guild.id, true));
}

export { calendarButtonMap };
