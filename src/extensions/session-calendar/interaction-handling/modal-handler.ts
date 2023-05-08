import { ModalSubmitInteraction } from 'discord.js';
import { ModalSubmitHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { CalendarModalNames } from '../calendar-constants/calendar-interaction-names.js';
import { CalendarSettingsConfigMenu } from '../calendar-constants/calendar-settings-menu.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from '../calendar-constants/calendar-success-messsages.js';
import { ExpectedCalendarErrors } from '../calendar-constants/expected-calendar-errors.js';
import {
    checkCalendarConnection,
    restorePublicEmbedURL
} from '../shared-calendar-functions.js';
import { AttendingServerV2 } from '../../../attending-server/base-attending-server.js';
import { CalendarExtensionState } from '../calendar-states.js';

const calendarModalMap: ModalSubmitHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [CalendarModalNames.CalendarSettingsModal]: interaction =>
                updateCalendarSettings(interaction, false),
            [CalendarModalNames.CalendarSettingsModalMenuVersion]: interaction =>
                updateCalendarSettings(interaction, true)
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
    const server = AttendingServerV2.get(interaction.guildId);
    const state = CalendarExtensionState.get(interaction.guildId);
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
              CalendarSettingsConfigMenu(
                  server,
                  interaction.channel?.id ?? '0',
                  false,
                  'Calendar settings have been saved! The embeds in #queue channels will refresh soon.'
              )
          )
        : interaction.reply({
              ...CalendarSuccessMessages.updatedCalendarSettings(
                  calendarId,
                  publicEmbedUrl
              ),
              ephemeral: true
          }));
}

export { calendarModalMap };
