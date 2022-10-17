import {
    ModalBuilder,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { attendingServers } from '../global-states';

const queueAutoClearModal = new ModalBuilder()
    .setTitle('Set Queue Auto Clear')
    .setCustomId('queue_auto_clear_modal')
    .setComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('auto_clear_hours')
                .setLabel('Hours')
                .setPlaceholder('Enter hours (0~24)')
                .setMaxLength(2)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('0')
        ),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('auto_clear_minutes')
                .setLabel('Minutes')
                .setPlaceholder('Enter minutes (0~59)')
                .setMaxLength(2)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('0')
        )
    );

function afterSessionMessageModal(serverId: string): ModalBuilder {
    const modal = new ModalBuilder()
        .setTitle('Set After Session Message')
        .setCustomId('after_session_message_modal')
        .setComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('after_session_msg')
                    .setLabel('Leave blank to disable') // There is a character limit for labels
                    .setPlaceholder('Enter your message here')
                    .setValue(attendingServers.get(serverId)?.afterSessionMessage ?? '')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
            )
        );
    return modal;
}

export { queueAutoClearModal, afterSessionMessageModal };
