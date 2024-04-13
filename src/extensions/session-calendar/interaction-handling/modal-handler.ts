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
} from '../shared-functions.js';
import { AttendingServer } from '../../../attending-server/base-attending-server.js';
import { CalendarExtensionState } from '../calendar-states.js';
import { CalendarIdQuickStart } from '../calendar-constants/calendar-quick-start-pages.js';

const calendarModalMap: ModalSubmitHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [CalendarModalNames.CalendarIdModal]: interaction =>
                updateCalendarSettings(interaction, 'command'),
            [CalendarModalNames.CalendarIdModalSettingsVersion]: interaction =>
                updateCalendarSettings(interaction, 'settings'),
            [CalendarModalNames.CalendarIdModalQuickStartVersion]: interaction =>
                updateCalendarSettings(interaction, 'quickStart')
        }
    },
    dmMethodMap: {}
};

/**
 * Sets the calendar id and public embed url
 * @param interaction
 * @param source where the modal was invoked, controls how the message is updated
 * @returns
 */
async function updateCalendarSettings(
    interaction: ModalSubmitInteraction<'cached'>,
    source: 'settings' | 'quickStart' | 'command'
): Promise<void> {
    if (!interaction.isFromMessage()) {
        return;
    }

    const server = AttendingServer.get(interaction.guildId);
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

    switch (source) {
        case 'settings':
            await interaction.update(
                CalendarSettingsConfigMenu(
                    server,
                    false,
                    'Calendar settings have been saved! The embeds in #queue channels will refresh soon.'
                )
            );
            return;

        case 'quickStart':
            await interaction.update(
                CalendarIdQuickStart(server, 'Calendar settings have been saved!')
            );
            return;

        case 'command':
            await interaction.reply({
                ...CalendarSuccessMessages.updatedCalendarSettings(
                    calendarId,
                    publicEmbedUrl
                ),
                ephemeral: true
            });
            return;
    }
}

export { calendarModalMap };
