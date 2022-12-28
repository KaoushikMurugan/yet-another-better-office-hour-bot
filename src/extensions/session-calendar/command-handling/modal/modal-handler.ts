import { ModalSubmitInteraction } from 'discord.js';
import { decompressComponentId } from '../../../../utils/component-id-factory.js';
import { ErrorEmbed, ErrorLogEmbed } from '../../../../utils/embed-helper.js';
import { ModalSubmitCallback, YabobEmbed } from '../../../../utils/type-aliases.js';
import { logModalSubmit } from '../../../../utils/util-functions.js';
import type { CalendarInteractionExtension } from '../../calendar-command-extension.js';
import { ExpectedCalendarErrors } from '../../expected-calendar-errors.js';
import {
    isServerCalendarInteraction,
    checkCalendarConnection,
    restorePublicEmbedURL
} from '../../shared-calendar-functions.js';
import { calendarSettingsConfigMenu } from '../calendar-settings-menus.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from '../calendar-success-messages.js';
import { CalendarModalNames } from '../../calendar-interaction-names.js';

const updateParentInteractionModals: string[] = [
    CalendarModalNames.CalendarSettingsModalMenuVersion
];

const modalMethodMap: { [modalName: string]: ModalSubmitCallback } = {
    [CalendarModalNames.CalendarSettingsModal]: interaction =>
        updateCalendarSettings(interaction, false),
    [CalendarModalNames.CalendarSettingsModalMenuVersion]: interaction =>
        updateCalendarSettings(interaction, true)
} as const;

function canHandleCalendarModalSubmit(
    this: CalendarInteractionExtension,
    interaction: ModalSubmitInteraction
): boolean {
    const modalName = decompressComponentId(interaction.customId)[1];
    return modalName in modalMethodMap;
}

async function processCalendarModalSubmit(
    this: CalendarInteractionExtension,
    interaction: ModalSubmitInteraction<'cached'>
): Promise<void> {
    const modalName = decompressComponentId(interaction.customId)[1];
    const [server] = isServerCalendarInteraction(interaction);
    const modalMethod = modalMethodMap[modalName];
    logModalSubmit(interaction, modalName);
    // Everything is reply here because showModal is guaranteed to be the 1st response
    // modal shown => message not replied, so we always reply
    await modalMethod?.(interaction)
        .then(async successMsg => {
            if (updateParentInteractionModals.includes(modalName)) {
                await (interaction.isFromMessage()
                    ? interaction.update(successMsg)
                    : interaction.reply({
                          ...successMsg,
                          ephemeral: true
                      }));
            }
        })
        .catch(async err => {
            await Promise.all([
                interaction.replied
                    ? interaction.editReply(ErrorEmbed(err, server.botAdminRoleID))
                    : interaction.reply({
                          ...ErrorEmbed(err, server.botAdminRoleID),
                          ephemeral: true
                      }),
                server?.sendLogMessage(ErrorLogEmbed(err, interaction))
            ]);
        });
}

/**
 * Sets the calendar id and public embed url
 * @param interaction
 * @param useMenu if true, then returns the menu embed. else returns the success embed
 * @returns
 */
async function updateCalendarSettings(
    interaction: ModalSubmitInteraction<'cached'>,
    useMenu: boolean
): Promise<YabobEmbed> {
    const [server, state, safeInteraction] = isServerCalendarInteraction(interaction);
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
    return useMenu
        ? calendarSettingsConfigMenu(server, safeInteraction.channel.id, false)
        : CalendarSuccessMessages.updatedCalendarSettings(calendarId, publicEmbedUrl);
}

export { canHandleCalendarModalSubmit, processCalendarModalSubmit };
