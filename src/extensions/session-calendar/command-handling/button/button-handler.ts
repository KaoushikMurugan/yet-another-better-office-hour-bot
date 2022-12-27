import { ButtonInteraction, TextBasedChannel } from 'discord.js';
import { environment } from '../../../../environment/environment-manager.js';
import { decompressComponentId } from '../../../../utils/component-id-factory.js';
import {
    ButtonLogEmbed,
    EmbedColor,
    ErrorEmbed,
    ErrorLogEmbed,
    SimpleEmbed
} from '../../../../utils/embed-helper.js';
import {
    QueueButtonCallback,
    DefaultButtonCallback,
    YabobEmbed
} from '../../../../utils/type-aliases.js';
import { logButtonPress } from '../../../../utils/util-functions.js';
import type { CalendarInteractionExtension } from '../../calendar-command-extension.js';
import { isServerCalendarInteraction } from '../../shared-calendar-functions.js';
import { calendarSettingsConfigMenu } from '../calendar-settings-menus.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from '../calendar-success-messages.js';
import { calendarSettingsModal } from '../modal/calendar-modal-objects.js';
import { CalendarButtonNames } from '../../calendar-interaction-names.js';

// #region Method Maps

const queueButtonMethodMap: { [buttonName: string]: QueueButtonCallback } = {
    [CalendarButtonNames.Refresh]: requestCalendarRefresh
} as const;

const defaultButtonMethodMap: { [buttonName: string]: DefaultButtonCallback } = {
    [CalendarButtonNames.ResetCalendarSettings]: resetCalendarSettings
} as const;

const updateParentInteractionButtons: string[] = [
    CalendarButtonNames.ShowCalendarSettingsModal,
    CalendarButtonNames.ResetCalendarSettings
];

const showModalOnlyButtons: {
    [buttonName: string]: (i: ButtonInteraction<'cached'>) => Promise<void>;
} = {
    [CalendarButtonNames.ShowCalendarSettingsModal]: showCalendarSettingsModal
} as const;

// #endregion

// #region canHandle check, process button

// the `this` parameter asserts the `this` binding of this function
// - The lexical environment must be the CalendarInteractionExtension class,
// not anything else
function canHandleCalendarButton(
    this: CalendarInteractionExtension,
    interaction: ButtonInteraction
): boolean {
    const buttonName = decompressComponentId(interaction.customId)[1];
    return (
        buttonName in queueButtonMethodMap ||
        buttonName in defaultButtonMethodMap ||
        buttonName in showModalOnlyButtons
    );
}

async function processCalendarButton(
    this: CalendarInteractionExtension,
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const [buttonType, buttonName, , channelId] = decompressComponentId(
        interaction.customId
    );
    const [server] = isServerCalendarInteraction(interaction);
    const queueName =
        (await server.getQueueChannels()).find(
            queueChannel => queueChannel.channelObj.id === channelId
        )?.queueName ?? '';
    const updateParentInteraction = updateParentInteractionButtons.includes(buttonName);
    if (buttonName in showModalOnlyButtons) {
        await showModalOnlyButtons[buttonName]?.(interaction);
        return;
    }
    if (!updateParentInteraction) {
        const msg =
            `Processing button \`${interaction.component.label ?? buttonName}` +
            (queueName.length > 0 ? `\` in \`${queueName}\` ...` : '');
        await (interaction.replied
            ? interaction.editReply(SimpleEmbed(msg, EmbedColor.Neutral))
            : interaction.reply({
                  ...SimpleEmbed(msg, EmbedColor.Neutral),
                  ephemeral: true
              }));
    }
    logButtonPress(interaction, buttonName, queueName);
    await (buttonType === 'queue'
        ? queueButtonMethodMap[buttonName]?.(queueName, interaction)
        : defaultButtonMethodMap[buttonName]?.(interaction)
    )
        ?.then(async successMsg => {
            await (updateParentInteraction
                ? interaction.update(successMsg)
                : interaction.editReply(successMsg));
        })
        .catch(async err => {
            // Central error handling, reply to user with the error
            await Promise.all([
                interaction.replied
                    ? interaction.editReply(ErrorEmbed(err, server.botAdminRoleID))
                    : interaction.reply({
                          ...ErrorEmbed(err, server.botAdminRoleID),
                          ephemeral: true
                      }),
                server.sendLogMessage(ErrorLogEmbed(err, interaction))
            ]);
        });
}

// #endregion canHandle check, process button

// #region Button Methods

async function resetCalendarSettings(
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, state] = isServerCalendarInteraction(interaction);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Reset Calendar URLs`,
            interaction.channel as TextBasedChannel
        )
    );
    await Promise.all([
        state.setCalendarId(environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID),
        server.sendLogMessage(CalendarLogMessages.backedUpToFirebase)
    ]);
    return calendarSettingsConfigMenu(server, interaction.channelId, false);
}

/**
 * Refreshes the calendar emebed for the specified queue
 * @param queueName
 * @param interaction
 */
async function requestCalendarRefresh(
    queueName: string,
    interaction: ButtonInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, state] = isServerCalendarInteraction(interaction);
    const queueLevelExtension = state.listeners.get(queueName);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Refresh Upcoming Sessions`,
            interaction.channel as TextBasedChannel
        )
    );
    await queueLevelExtension?.onCalendarStateChange();
    return CalendarSuccessMessages.refreshSuccess(queueName);
}

/**
 * Prompts the calendar settings modal
 * @remark follow up to a menu button
 * @param interaction
 */
async function showCalendarSettingsModal(
    interaction: ButtonInteraction<'cached'>
): Promise<void> {
    const [server] = isServerCalendarInteraction(interaction);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Set Calendar URLs`,
            interaction.channel as TextBasedChannel
        )
    );
    await interaction.showModal(calendarSettingsModal(server.guild.id, true));
}

// #endregion Button Methods

export { canHandleCalendarButton, processCalendarButton };
