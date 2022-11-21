import {
    ModalBuilder,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import {
    generateYabobModalId,
    yabobModalIdToString
} from '../../../utils/util-functions.js';
import { calendarStates } from '../calendar-states.js';

/**
 * Composes the calendar settings modal
 * @param serverId
 * @param menuVersion
 * @returns
 */
function calendarSettingsModal(serverId: string, menuVersion = false): ModalBuilder {
    const state = calendarStates.get(serverId);
    const modal = new ModalBuilder()
        .setTitle('Calendar Settings')
        .setCustomId(
            yabobModalIdToString(
                generateYabobModalId(
                    'other',
                    'calendar_settings_modal' + (menuVersion ? '_mv' : '')
                )
            )
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
