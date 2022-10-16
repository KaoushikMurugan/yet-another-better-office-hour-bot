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
            'after_session_message_modal',
            interaction => this.setAfterSessionMessage(interaction)
        ],
        ['queue_auto_clear_modal', interaction => this.setQueueAutoClear(interaction)]
    ]);

    canHandle(interaction: ModalSubmitInteraction): boolean {
        return this.modalMethodMap.has(interaction.customId);
    }

    async processModal(interaction: ModalSubmitInteraction): Promise<void> {
        const modalMethod = this.modalMethodMap.get(interaction.customId);
        // Everything is reply here because showModal is guaranteed to be the 1st response
        // modal shown => message not replied, so we always reply
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
        return `After session message set to:\n${message}`;
    }

    private async setQueueAutoClear(
        interaction: ModalSubmitInteraction
    ): Promise<string> {
        const serverId = await this.isServerInteraction(interaction);
        const hoursInput = interaction.fields.getTextInputValue('auto_clear_hours');
        const minutesInput = interaction.fields.getTextInputValue('auto_clear_minutes');
        const hours = hoursInput === '' ? 0 : parseInt(hoursInput);
        const minutes = minutesInput === '' ? 0 : parseInt(minutesInput);

        if (hours === 0 && minutes === 0) {
            await attendingServers.get(serverId)?.setQueueAutoClear(hours, minutes, false);
            return `Successfully disabled queue auto clear.`;
        }
        await attendingServers.get(serverId)?.setQueueAutoClear(hours, minutes, true);
        return (
            `Successfully enabled queue auto clear. ` +
            `Queues will be automatically cleared in ` +
            `${hours} hours and ${minutes} minutes after they are closed.`
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
