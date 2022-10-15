import { ModalSubmitInteraction } from 'discord.js';
import { AutoClearTimeout } from '../help-queue/help-queue';
import { cyan, yellow, magenta } from '../utils/command-line-colors';
import { ErrorEmbed, ErrorLogEmbed, SimpleEmbed } from '../utils/embed-helper';
import {
    CommandNotImplementedError,
    CommandParseError,
    UserViewableError
} from '../utils/error-types';
import { ModalSubmitCallback } from '../utils/type-aliases';
import { attendingServers } from '../global-states';

class ModalDispatcher {
    modalMethodMap: ReadonlyMap<string, ModalSubmitCallback> = new Map<
        string,
        ModalSubmitCallback
    >([
        [
            'set_after_session_message_modal',
            interaction => this.setAfterSessionMessage(interaction)
        ],
        ['set_queue_auto_clear_modal', interaction => this.setQueueAutoClear(interaction)]
    ]);

    canHandle(interaction: ModalSubmitInteraction): boolean {
        return this.modalMethodMap.has(interaction.customId);
    }

    async processModal(interaction: ModalSubmitInteraction): Promise<void> {
        const modalMethod = this.modalMethodMap.get(interaction.customId);
        if (modalMethod === undefined) {
            await interaction.reply({
                ...ErrorEmbed(
                    new CommandNotImplementedError('This command does not exist.')
                ),
                ephemeral: true
            });
            return;
        }
        console.log(
            `[${cyan(
                new Date().toLocaleString('en-US', {
                    timeZone: 'PST8PDT'
                })
            )} ` +
                `${yellow(interaction.guild?.name)}]\n` +
                ` - User: ${interaction.user.username} (${interaction.user.id})\n` +
                ` - Server Id: ${interaction.guildId}\n` +
                ` - Modal Used: ${magenta(interaction.customId)}`
        );
        await modalMethod(interaction)
            .then(async successMsg => {
                if (typeof successMsg === 'string') {
                    await interaction.reply(SimpleEmbed(successMsg));
                } else if (successMsg !== undefined) {
                    await interaction.reply({
                        ...successMsg
                    });
                }
            })
            .catch(async (err: UserViewableError) => {
                const serverId = (await this.isServerInteraction(interaction)) ?? '';
                await Promise.all([
                    interaction.reply({
                        ...ErrorEmbed(err)
                    }),
                    attendingServers
                        .get(serverId)
                        ?.sendLogMessage(ErrorLogEmbed(err, interaction))
                ]);
            });
    }

    private async setAfterSessionMessage(
        interaction: ModalSubmitInteraction
    ): Promise<string> {
        // let this throw so it will be caught and sent back to the user
        const serverId = await this.isServerInteraction(interaction);
        const newAfterSessionMessage =
            interaction.fields.getTextInputValue('after_session_msg');
        await attendingServers
            .get(serverId)
            ?.setAfterSessionMessage(newAfterSessionMessage);
        const message = interaction.fields.getTextInputValue('after_session_msg');
        return `After session message set to: ${message}`;
    }

    private async setQueueAutoClear(
        interaction: ModalSubmitInteraction
    ): Promise<string> {
        // You have to check the values again, since the internal values don't get updated until after the modal is closed
        // for some reason this gets called before the modal is closed
        const hoursInput = interaction.fields.getTextInputValue(
            'set_queue_auto_clear_modal_hours'
        );
        const minutesInput = interaction.fields.getTextInputValue(
            'set_queue_auto_clear_modal_minutes'
        );
        let newQueueAutoClearHours: AutoClearTimeout;
        let newQueueAutoClearMinutes: AutoClearTimeout;

        if (hoursInput === '' && minutesInput === '') {
            newQueueAutoClearHours = 'AUTO_CLEAR_DISABLED';
            newQueueAutoClearMinutes = 'AUTO_CLEAR_DISABLED';
        } else {
            if (
                hoursInput === '' ||
                isNaN(Number(hoursInput)) ||
                Number(hoursInput) < 0
            ) {
                newQueueAutoClearHours = 0;
            } else {
                newQueueAutoClearHours = parseInt(hoursInput);
            }
            if (
                minutesInput === '' ||
                isNaN(Number(minutesInput)) ||
                Number(minutesInput) < 0
            ) {
                newQueueAutoClearMinutes = 0;
            } else {
                newQueueAutoClearMinutes = parseInt(minutesInput);
            }
        }

        if (newQueueAutoClearHours === 0 && newQueueAutoClearMinutes === 0) {
            newQueueAutoClearHours = 'AUTO_CLEAR_DISABLED';
            newQueueAutoClearMinutes = 'AUTO_CLEAR_DISABLED';
        }

        return Promise.resolve(
            newQueueAutoClearHours !== 'AUTO_CLEAR_DISABLED'
                ? `Successfully changed the auto clear timeout to be ${newQueueAutoClearHours} h and ${newQueueAutoClearMinutes} m.`
                : 'Successfully disabled queue auto clear.'
        );
    }

    /**
     * Checks if the command came from a server with correctly initialized YABOB
     * Each handler will have their own isServerInteraction method
     * ----
     * @returns string: the server id
     */
    private async isServerInteraction(
        interaction: ModalSubmitInteraction
    ): Promise<string> {
        const serverId = interaction.guild?.id;
        if (!serverId || !attendingServers.has(serverId)) {
            return Promise.reject(
                new CommandParseError(
                    'I can only accept server based interactions. ' +
                        `Are you sure ${interaction.guild?.name} has a initialized YABOB?`
                )
            );
        } else {
            return serverId;
        }
    }
}

export { ModalDispatcher };
