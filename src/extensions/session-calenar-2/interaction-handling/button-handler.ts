import { ButtonInteraction } from 'discord.js';
import { environment } from '../../../environment/environment-manager.js';
import { ButtonHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { CalendarButtonNames } from '../../session-calendar/calendar-interaction-names.js';
import { calendarSettingsConfigMenu } from '../../session-calendar/command-handling/calendar-settings-menus.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from '../../session-calendar/command-handling/calendar-success-messages.js';
import { calendarSettingsModal } from '../../session-calendar/command-handling/modal/calendar-modal-objects.js';
import { isServerCalendarInteraction } from '../../session-calendar/shared-calendar-functions.js';
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
    skipProgressMessageButtons: new Set([CalendarButtonNames.ShowCalendarSettingsModal])
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
        calendarSettingsConfigMenu(server, interaction.channelId, false)
    );
}

/**
 * Refreshes the calendar emebed for the specified queue
 * @param queueName
 * @param interaction
 */
async function requestCalendarRefresh(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const state = isServerCalendarInteraction(interaction)[1];
    const queueName = isFromQueueChannelWithParent(interaction).queueName;
    const queueLevelExtension = state.listeners.get(queueName);
    await queueLevelExtension?.onCalendarStateChange();
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
