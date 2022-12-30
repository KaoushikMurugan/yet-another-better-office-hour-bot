// const updateParentInteractionModals: string[] = [
//     CalendarModalNames.CalendarSettingsModalMenuVersion
// ];

import { ModalSubmitInteraction } from 'discord.js';
import { ModalSubmitHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { CalendarModalNames } from '../../session-calendar/calendar-interaction-names.js';
import { calendarSettingsConfigMenu } from '../../session-calendar/command-handling/calendar-settings-menus.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from '../../session-calendar/command-handling/calendar-success-messages.js';
import { ExpectedCalendarErrors } from '../../session-calendar/expected-calendar-errors.js';
import {
    isServerCalendarInteraction,
    checkCalendarConnection,
    restorePublicEmbedURL
} from '../../session-calendar/shared-calendar-functions.js';

const calendarModalMap: ModalSubmitHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [CalendarModalNames.CalendarSettingsModal]: interaction =>
                updateCalendarSettings(interaction, false),
            [CalendarModalNames.CalendarSettingsModal]: interaction =>
                updateCalendarSettings(interaction, false)
        }
    },
    dmMethodMap: {}
};

/**
 * Sets the calendar id and public embed url
 * @param interaction
 * @param useMenu if true, then returns the menu embed. else returns the success embed
 * @returns
 */
async function updateCalendarSettings(
    interaction: ModalSubmitInteraction<'cached'>,
    useMenu: boolean
): Promise<void> {
    const [server, state, safeInteraction] = isServerCalendarInteraction(interaction);
    const calendarId = interaction.fields.getTextInputValue('calendar_id');
    const publicEmbedUrl = interaction.fields.getTextInputValue('public_embed_url');
    await checkCalendarConnection(calendarId).catch(() => {
        throw ExpectedCalendarErrors.badId.newId;
    });
    await state.setCalendarId(calendarId);
    if (publicEmbedUrl !== '') {
        try {
            new URL(publicEmbedUrl);
        } catch {
            throw ExpectedCalendarErrors.badPublicEmbedUrl;
        }
        // now rawUrl is valid
        await state.setPublicEmbedUrl(publicEmbedUrl);
    } else {
        await state.setPublicEmbedUrl(restorePublicEmbedURL(state.calendarId));
    }
    server.sendLogMessage(CalendarLogMessages.backedUpToFirebase);
    await (useMenu && interaction.isFromMessage()
        ? interaction.update(
              calendarSettingsConfigMenu(server, safeInteraction.channel.id, false)
          )
        : interaction.reply(
              CalendarSuccessMessages.updatedCalendarSettings(calendarId, publicEmbedUrl)
          ));
}

export { calendarModalMap };
