import {
    ModalBuilder,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { modalFactory } from '../../../utils/component-id-factory.js';
import { calendarStates } from '../calendar-states.js';

/**
 * Composes the calendar settings modal
 * @param serverId
 * @param useMenu
 * @returns
 */
function calendarSettingsModal(serverId: string, useMenu = false): ModalBuilder {
    const state = calendarStates.get(serverId);
    const modal =
        modalFactory
            .buildComponent(
                'other',
                'calendar_settings_modal' + (useMenu ? '_mv' : ''),
                undefined,
                undefined
            )
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
                            'Enter calendar embed url, leave blank to default to google calendar'
                        )
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                        .setValue(state?.publicCalendarEmbedUrl ?? '')
                )
            );
    return modal;
}

export { calendarSettingsModal };
