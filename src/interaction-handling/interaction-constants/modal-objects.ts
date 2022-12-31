/** @module BuiltInHandlers */
import {
    ModalBuilder,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    TextInputBuilder,
    TextInputStyle,
    Snowflake
} from 'discord.js';
import { attendingServers } from '../../global-states.js';
import { buildComponent, UnknownId } from '../../utils/component-id-factory.js';
import { ModalNames } from './interaction-names.js';

/**
 * Creates a modal for the user to set the queue auto clear time.
 * Has two number inputs:
 * - Hours (2 characters max)
 * - Minutes (2 characters max)
 * @param useMenu whether to return the menu version of queue auto clear modal
 * @returns
 */
function queueAutoClearModal(serverId: Snowflake, useMenu = false): ModalBuilder {
    const oldTimeout = attendingServers.get(serverId)?.queueAutoClearTimeout;
    const modal = buildComponent(new ModalBuilder(), [
        'other',
        useMenu
            ? ModalNames.QueueAutoClearModalMenuVersion
            : ModalNames.QueueAutoClearModal,
        serverId,
        UnknownId
    ])
        .setTitle('Set Queue Auto Clear')
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
 * Creates a modal for the user to set the after session message.
 * Has one paragraph text input:
 * - After session message
 * @param serverId
 * @returns
 */
function afterSessionMessageModal(serverId: Snowflake, useMenu = false): ModalBuilder {
    const modal = buildComponent(new ModalBuilder(), [
        'other',
        useMenu
            ? ModalNames.AfterSessionMessageModalMenuVersion
            : ModalNames.AfterSessionMessageModal,
        serverId,
        UnknownId
    ])
        .setTitle('Set After Session Message')
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
