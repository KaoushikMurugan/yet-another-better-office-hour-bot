import {
    ModalBuilder,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    TextInputBuilder,
    TextInputStyle,
    Snowflake
} from 'discord.js';
import { buildComponent, UnknownId } from '../../../utils/component-id-factory.js';
import { CalendarExtensionState } from '../calendar-states.js';
import { CalendarModalNames } from './calendar-interaction-names.js';

/**
 * Composes the calendar settings modal
 * @param serverId related server id
 * @param useMenu whether this modal should show the settings menu or the success message
 * @returns the settings modal
 */
function CalendarSettingsModal(serverId: Snowflake, useMenu = false): ModalBuilder {
    const state = CalendarExtensionState.allStates.get(serverId);
    const modal = buildComponent(new ModalBuilder(), [
        'other',
        useMenu
            ? CalendarModalNames.CalendarSettingsModalMenuVersion
            : CalendarModalNames.CalendarSettingsModal,
        serverId,
        UnknownId
    ])
        .setTitle('Calendar Settings')
        .setComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('calendar_id')
                    .setLabel('Calendar ID')
                    .setPlaceholder('Enter calendar id')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setValue(state?.calendarId ?? '')
            ),
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('public_embed_url')
                    .setLabel('Public Embed URL')
                    .setPlaceholder(
                        'Enter calendar embed url, leave blank to use the default google calendar embed.'
                    )
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setValue(state?.publicCalendarEmbedUrl ?? '')
            )
        );
    return modal;
}

export { CalendarSettingsModal };
