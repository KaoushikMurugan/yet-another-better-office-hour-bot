/** @module BuiltInHandlers */

import { ModalSubmitInteraction } from 'discord.js';
import { ErrorEmbed, ErrorLogEmbed, SimpleEmbed } from '../utils/embed-helper';
import { ModalMethodMap } from '../utils/type-aliases';
import { logModalSubmit } from '../utils/util-functions';
import { SuccessMessages } from './builtin-success-messages';
import { isServerInteraction } from './common-validations';

/**
 * Built in handler for modal submit
 * @category Handler Class
 */
class BuiltInModalHandler {
    private methodMap: ModalMethodMap = new Map([
        [
            'after_session_message_modal',
            interaction => this.setAfterSessionMessage(interaction)
        ],
        ['queue_auto_clear_modal', interaction => this.setQueueAutoClear(interaction)]
    ]);

    canHandle(interaction: ModalSubmitInteraction): boolean {
        return this.methodMap.has(interaction.customId);
    }

    async process(interaction: ModalSubmitInteraction): Promise<void> {
        const modalMethod = this.methodMap.get(interaction.customId);
        logModalSubmit(interaction);
        // if process is called then modalMethod is definitely not null
        // this is checked in app.ts with `modalHandler.canHandle`
        await modalMethod?.(interaction)
            // Everything is reply here because showModal is guaranteed to be the 1st response
            // modal shown => message not replied, so we always reply
            .then(async successMsg => {
                if (typeof successMsg === 'string') {
                    await interaction.reply({
                        ...SimpleEmbed(successMsg),
                        ephemeral: true
                    });
                } else if (successMsg !== undefined) {
                    await interaction.reply({ ...successMsg, ephemeral: true });
                }
            })
            .catch(async err => {
                const server = isServerInteraction(interaction);
                await Promise.all([
                    interaction.replied
                        ? interaction.editReply(ErrorEmbed(err))
                        : interaction.reply({ ...ErrorEmbed(err), ephemeral: true }),
                    server?.sendLogMessage(ErrorLogEmbed(err, interaction))
                ]);
            });
    }

    private async setAfterSessionMessage(
        interaction: ModalSubmitInteraction
    ): Promise<string> {
        const server = isServerInteraction(interaction);
        const newAfterSessionMessage =
            interaction.fields.getTextInputValue('after_session_msg');
        server?.setAfterSessionMessage(newAfterSessionMessage);
        const message = interaction.fields.getTextInputValue('after_session_msg');
        return SuccessMessages.updatedAfterSessionMessage(message);
    }

    private async setQueueAutoClear(
        interaction: ModalSubmitInteraction
    ): Promise<string> {
        const server = isServerInteraction(interaction);
        const hoursInput = interaction.fields.getTextInputValue('auto_clear_hours');
        const minutesInput = interaction.fields.getTextInputValue('auto_clear_minutes');
        const hours = hoursInput === '' ? 0 : parseInt(hoursInput);
        const minutes = minutesInput === '' ? 0 : parseInt(minutesInput);
        if (hours === 0 && minutes === 0) {
            await server.setQueueAutoClear(hours, minutes, false);
            return SuccessMessages.queueAutoClear.disabled;
        }
        await server.setQueueAutoClear(hours, minutes, true);
        return SuccessMessages.queueAutoClear.enabled(hours, minutes);
    }
}

export { BuiltInModalHandler };
