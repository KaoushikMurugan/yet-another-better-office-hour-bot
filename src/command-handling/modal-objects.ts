/** @module BuiltInHandlers */
import {
    ModalBuilder,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { attendingServers } from '../global-states.js';
import { generateYabobModalId, yabobModalToString } from '../utils/util-functions.js';

/**
 * Creats a modal for the user to set the queue auto clear time.
 * Has two number inputs:
 * - Hours (2 characters max)
 * - Minutes (2 characters max)
 * @param useMenu whether to return the menu version of queue auto clear modal
 * @returns
 */
function queueAutoClearModal(serverId: string, useMenu = false): ModalBuilder {
    const oldTimeout = attendingServers.get(serverId)?.queueAutoClearTimeout;
    const modal = new ModalBuilder()
        .setTitle('Set Queue Auto Clear')
        .setCustomId(
            yabobModalToString(
                generateYabobModalId(
                    'other',
                    'queue_auto_clear_modal' + (useMenu ? '_mv' : '')
                )
            )
        )
        .setComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('auto_clear_hours')
                    .setLabel('Hours (0 to disable)')
                    .setPlaceholder('Enter hours (0~24)')
                    .setMaxLength(2)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(
                        !oldTimeout || oldTimeout === 'AUTO_CLEAR_DISABLED'
                            ? '0'
                            : oldTimeout.hours.toString()
                    )
            ),
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('auto_clear_minutes')
                    .setLabel('Minutes (0 to disable)')
                    .setPlaceholder('Enter minutes (0~59)')
                    .setMaxLength(2)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(
                        !oldTimeout || oldTimeout === 'AUTO_CLEAR_DISABLED'
                            ? '0'
                            : oldTimeout.minutes.toString()
                    )
            )
        );
    return modal;
}

/**
 * Creats a modal for the user to set the after session message.
 * Has one paragraph text input:
 * - After session message
 * @param serverId
 * @returns
 */
function afterSessionMessageModal(serverId: string, menuVersion = false): ModalBuilder {
    const modal = new ModalBuilder()
        .setTitle('Set After Session Message')
        .setCustomId(
            yabobModalToString(
                generateYabobModalId(
                    'other',
                    'after_session_message_modal' + (menuVersion ? '_mv' : '')
                )
            )
        )
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
