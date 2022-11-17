/** @module SessionCalendar */
import {
    BaseInteractionExtension,
    IInteractionExtension
} from '../../extension-interface.js';
import { CalendarExtensionState, calendarStates } from '../calendar-states.js';
import {
    ButtonInteraction,
    CategoryChannel,
    ChatInputCommandInteraction,
    Guild,
    ModalSubmitInteraction,
    Role,
    TextBasedChannel
} from 'discord.js';
import {
    ButtonLogEmbed,
    EmbedColor,
    ErrorEmbed,
    ErrorLogEmbed,
    SimpleEmbed,
    SlashCommandLogEmbed
} from '../../../utils/embed-helper.js';
import { ExtensionSetupError } from '../../../utils/error-types.js';
import { CommandData } from '../../../command-handling/slash-commands.js';
import {
    hasValidQueueArgument,
    isTriggeredByMemberWithRoles
} from '../../../command-handling/common-validations.js';
import {
    checkCalendarConnection,
    composeUpcomingSessionsEmbedBody,
    getUpComingTutoringEvents,
    restorePublicEmbedURL,
    isServerCalendarInteraction
} from '../shared-calendar-functions.js';
import { blue, red, yellow } from '../../../utils/command-line-colors.js';
import { calendarCommands } from '../calendar-slash-commands.js';
import {
    getQueueRoles,
    isCategoryChannel,
    isQueueTextChannel,
    logButtonPress,
    logModalSubmit,
    logSlashCommand,
    parseYabobButtonId,
    parseYabobModalId
} from '../../../utils/util-functions.js';
import { appendCalendarHelpMessages } from './CalendarCommands.js';
import {
    QueueButtonCallback,
    CommandCallback,
    ModalSubmitCallback,
    YabobEmbed,
    DefaultButtonCallback
} from '../../../utils/type-aliases.js';
import { ExpectedCalendarErrors } from '../expected-calendar-errors.js';
import { ExpectedParseErrors } from '../../../command-handling/expected-interaction-errors.js';
import { environment } from '../../../environment/environment-manager.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from './calendar-success-messages.js';
import {
    appendSettingsMainMenuOptions,
    calendarSettingsConfigMenu
} from './calendar-settings-menus.js';
import { calendarSettingsModal } from './calendar-modal-objects.js';

class CalendarInteractionExtension
    extends BaseInteractionExtension
    implements IInteractionExtension
{
    protected constructor() {
        super();
    }

    private static helpEmbedsSent = false;
    private static settingsMainMenuOptionSent = false;

    /**
     * - Initializes the calendar extension using firebase backup if available
     * - Adds calendar extension slash commands to the server
     * - Adds calendar extension help messages to respective lists
     * @param guild
     * @returns CalendarInteractionExtension
     */
    static async load(guild: Guild): Promise<CalendarInteractionExtension> {
        if (
            environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID.length === 0 ||
            environment.sessionCalendar.YABOB_GOOGLE_API_KEY.length === 0
        ) {
            throw new ExtensionSetupError('Make sure you have Calendar ID and API key');
        }
        const calendarName = await checkCalendarConnection(
            environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID
        ).catch(() => {
            throw ExpectedCalendarErrors.badId.defaultId;
        });
        calendarStates.set(guild.id, await CalendarExtensionState.load(guild));
        const instance = new CalendarInteractionExtension();
        appendCalendarHelpMessages(CalendarInteractionExtension.helpEmbedsSent);
        appendSettingsMainMenuOptions(
            CalendarInteractionExtension.settingsMainMenuOptionSent
        );
        CalendarInteractionExtension.helpEmbedsSent = true;
        CalendarInteractionExtension.settingsMainMenuOptionSent = true;
        console.log(
            `[${blue('Session Calendar')}] ` +
                `successfully loaded for '${guild.name}'!\n` +
                ` - Using ${yellow(calendarName)} as the default calendar`
        );
        return instance;
    }

    override get slashCommandData(): CommandData {
        return calendarCommands;
    }

    override canHandleButton(interaction: ButtonInteraction): boolean {
        const yabobButtonId = parseYabobButtonId(interaction.customId);
        return (
            yabobButtonId.name in queueButtonMethodMap ||
            yabobButtonId.name in defaultButtonMethodMap ||
            yabobButtonId.name in showModalOnlyButtons
        );
    }

    override canHandleCommand(interaction: ChatInputCommandInteraction): boolean {
        return interaction.commandName in commandMethodMap;
    }

    override canHandleModalSubmit(interaction: ModalSubmitInteraction): boolean {
        const yabobModalId = parseYabobModalId(interaction.customId);
        return yabobModalId.name in modalMethodMap;
    }

    override async processCommand(
        interaction: ChatInputCommandInteraction<'cached'>
    ): Promise<void> {
        //Send logs before* processing the command
        const [server] = isServerCalendarInteraction(interaction);
        await interaction.reply({
            ...SimpleEmbed(
                `Processing command \`${interaction.commandName}\` ...`,
                EmbedColor.Neutral
            ),
            ephemeral: true
        });
        server.sendLogMessage(SlashCommandLogEmbed(interaction));
        const commandMethod = commandMethodMap[interaction.commandName];
        logSlashCommand(interaction);
        await commandMethod?.(interaction)
            .then(successMessage => interaction.editReply(successMessage))
            .catch(async err =>
                interaction.replied
                    ? await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID))
                    : await interaction.reply({
                          ...ErrorEmbed(err, server.botAdminRoleID),
                          ephemeral: true
                      })
            );
    }

    override async processButton(
        interaction: ButtonInteraction<'cached'>
    ): Promise<void> {
        const yabobButtonId = parseYabobButtonId(interaction.customId);
        const buttonName = yabobButtonId.name;
        const buttonType = yabobButtonId.type;
        const [server] = isServerCalendarInteraction(interaction);
        const queueName =
            (await server.getQueueChannels()).find(
                queueChannel => queueChannel.channelObj.id === yabobButtonId.cid
            )?.queueName ?? '';

        const updateParentInteraction =
            updateParentInteractionButtons.includes(buttonName);

        if (buttonName in showModalOnlyButtons) {
            await showModalOnlyButtons[buttonName]?.(interaction);
            return;
        }

        if (!updateParentInteraction) {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    ...SimpleEmbed(
                        `Processing button \`${
                            interaction.component.label ?? buttonName
                        }` + (queueName.length > 0 ? `\` in \`${queueName}\` ...` : ''),
                        EmbedColor.Neutral
                    )
                });
            } else {
                await interaction.reply({
                    ...SimpleEmbed(
                        `Processing button \`${
                            interaction.component.label ?? buttonName
                        }` + (queueName.length > 0 ? `\` in \`${queueName}\` ...` : ''),
                        EmbedColor.Neutral
                    ),
                    ephemeral: true
                });
            }
        }
        logButtonPress(interaction, buttonName, queueName);
        await (buttonType === 'queue'
            ? queueButtonMethodMap[buttonName]?.(queueName, interaction)
            : defaultButtonMethodMap[buttonName]?.(interaction)
        )
            ?.then(async successMsg => {
                if (updateParentInteraction) {
                    await interaction.update(successMsg);
                } else {
                    await interaction.editReply(successMsg);
                }
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

    override async processModalSubmit(
        interaction: ModalSubmitInteraction<'cached'>
    ): Promise<void> {
        const yabobModalId = parseYabobModalId(interaction.customId);
        const modalName = yabobModalId.name;
        const [server] = isServerCalendarInteraction(interaction);
        const modalMethod = modalMethodMap[modalName];
        logModalSubmit(interaction, modalName);
        await modalMethod?.(interaction)
            // Everything is reply here because showModal is guaranteed to be the 1st response
            // modal shown => message not replied, so we always reply
            .then(async successMsg => {
                if (
                    updateParentInteractionModals.includes(modalName) &&
                    interaction.isFromMessage()
                ) {
                    await interaction.update(successMsg);
                } else {
                    await interaction.reply({
                        ...successMsg,
                        ephemeral: true
                    });
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
}

const commandMethodMap: { [commandName: string]: CommandCallback } = {
    set_calendar: updateCalendarId,
    unset_calendar: unsetCalendarId,
    when_next: listUpComingHours,
    make_calendar_string: interaction => makeParsableCalendarTitle(interaction, false),
    make_calendar_string_all: interaction => makeParsableCalendarTitle(interaction, true),
    set_public_embd_url: setPublicEmbedUrl
} as const;

const queueButtonMethodMap: { [buttonName: string]: QueueButtonCallback } = {
    refresh: requestCalendarRefresh
} as const;

const defaultButtonMethodMap: { [buttonName: string]: DefaultButtonCallback } = {
    calendar_settings_config_menui_2: resetCalendarSettings
} as const;

const showModalOnlyButtons: {
    [buttonName: string]: (interaction: ButtonInteraction<'cached'>) => Promise<void>;
} = {
    calendar_settings_config_menui_1: showCalendarSettingsModal
} as const;

const updateParentInteractionButtons = [
    'calendar_settings_config_menui_1',
    'calendar_settings_config_menui_2'
];

const modalMethodMap: { [modalName: string]: ModalSubmitCallback } = {
    calendar_settings_modal: interaction => updateCalendarSettings(interaction, false),
    calendar_settings_modal_mv: interaction => updateCalendarSettings(interaction, true)
} as const;

const updateParentInteractionModals = ['calendar_settings_modal_mv'];

/**
 * The `/set_calendar [calendar_id]` command
 *
 * Updates the calendar id in the shared calendar extension states
 * - Triggers the queue level extensions to update
 */
async function updateCalendarId(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const newCalendarId = interaction.options.getString('calendar_id', true);
    const [newCalendarName] = [
        await checkCalendarConnection(newCalendarId).catch(() => {
            throw ExpectedCalendarErrors.badId.newId;
        })
    ];
    const [server, state] = isServerCalendarInteraction(interaction);
    await state.setCalendarId(newCalendarId);
    server.sendLogMessage(CalendarLogMessages.backedUpToFirebase);
    return CalendarSuccessMessages.updatedCalendarId(newCalendarName);
}

/**
 * The `/unset_calendar` command
 *
 * Resets the calendar id to default
 */
async function unsetCalendarId(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, state] = isServerCalendarInteraction(interaction);
    isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'unset_calendar',
        'Bot Admin'
    );
    await state.setCalendarId(environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID);
    server.sendLogMessage(CalendarLogMessages.backedUpToFirebase);
    return CalendarSuccessMessages.unsetCalendar;
}

/**
 * The `/when_next` command
 *
 * Builds the embed for /when_next
 */
async function listUpComingHours(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const channel = hasValidQueueArgument(interaction);
    const [server] = isServerCalendarInteraction(interaction);
    const viewModels = await getUpComingTutoringEvents(
        server.guild.id,
        channel.queueName
    );
    return SimpleEmbed(
        `Upcoming Hours for ${channel.queueName}`,
        EmbedColor.Blue,
        composeUpcomingSessionsEmbedBody(viewModels, channel, new Date())
    );
}

/**
 * The `/make_calendar_string` and `/make_calendar_string_all` commands
 *
 * Makes calendar titles for all approved queues
 * @param generateAll whether to generate string for all the queue roles
 */
async function makeParsableCalendarTitle(
    interaction: ChatInputCommandInteraction<'cached'>,
    generateAll: boolean
): Promise<YabobEmbed> {
    const [server, state] = isServerCalendarInteraction(interaction);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'make_calendar_string',
        'Staff'
    );
    const calendarDisplayName = interaction.options.getString('calendar_name', true);
    const userOption = interaction.options.getUser('user', false);
    let validQueueOptions: (CategoryChannel | Role)[];
    let memberToUpdate = member;
    if (userOption) {
        const memberRoles = memberToUpdate.roles;
        // if they are not admin or doesn't have the queue role, reject
        if (
            !memberRoles.cache.some(role => role.id === server.botAdminRoleID) &&
            userOption.id !== interaction.user.id
        ) {
            throw ExpectedCalendarErrors.nonAdminMakingCalendarStringForOthers;
        } else {
            memberToUpdate = await server.guild.members.fetch(userOption);
        }
    }
    if (generateAll) {
        validQueueOptions = await getQueueRoles(server, memberToUpdate);
    } else {
        // get all the non-null options
        // 20 is the same length as the slash command object.
        // The command cannot be updated after posting, so we have to hard code the size
        const commandArgs = Array(20)
            .fill(undefined)
            .map((_, index) =>
                // 1st option is required
                interaction.options.getChannel(`queue_name_${index + 1}`, index === 0)
            )
            .filter(queueArg => queueArg !== null);
        validQueueOptions = commandArgs.map(category => {
            if (!isCategoryChannel(category)) {
                throw ExpectedParseErrors.invalidQueueCategory(category?.name);
            }
            const queueTextChannel = category.children.cache.find(isQueueTextChannel);
            if (queueTextChannel === undefined) {
                throw ExpectedParseErrors.noQueueTextChannel(category.name);
            }
            return category;
        });
    }
    state
        .updateNameDiscordIdMap(calendarDisplayName, memberToUpdate.user.id)
        .catch(() =>
            console.error(
                `Calendar refresh timed out from ${red(
                    'updateNameDiscordIdMap'
                )} triggered by ${memberToUpdate.displayName}`
            )
        );
    server.sendLogMessage(CalendarLogMessages.backedUpToFirebase);
    return CalendarSuccessMessages.completedCalendarString(
        calendarDisplayName,
        validQueueOptions.map(queue => queue.name)
    );
}

/**
 * The `/set_public_embd_url` command
 *
 * Sets the public embed url for the server's calendar
 * @param interaction
 */
async function setPublicEmbedUrl(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    const [server, state] = isServerCalendarInteraction(interaction);
    const rawUrl = interaction.options.getString('url', true);
    const enable = interaction.options.getBoolean('enable', true);
    isTriggeredByMemberWithRoles(server, interaction.member, 'set_calendar', 'Bot Admin');
    if (enable) {
        try {
            new URL(rawUrl); // call this constructor to check if URL is valid
        } catch {
            throw ExpectedCalendarErrors.badPublicEmbedUrl;
        }
        // now rawUrl is valid
        await state.setPublicEmbedUrl(rawUrl);
        return CalendarSuccessMessages.publicEmbedUrl.updated;
    } else {
        await state.setPublicEmbedUrl(restorePublicEmbedURL(state?.calendarId));
        return CalendarSuccessMessages.publicEmbedUrl.backToDefault;
    }
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
    await queueLevelExtension?.onCalendarExtensionStateChange();
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

/**
 * Resets the calendar id and public embed url\
 * @remark follow up to a menu button
 * @param interaction
 */
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
 * Sets the calendar id and public embed url
 * @param interaction
 * @param menuVersion if true, then returns the menu embed. else returns the success embed
 * @returns
 */
async function updateCalendarSettings(
    interaction: ModalSubmitInteraction<'cached'>,
    menuVersion: boolean
): Promise<YabobEmbed> {
    const [server, state] = isServerCalendarInteraction(interaction);
    const calendarId = interaction.fields.getTextInputValue('calendar_id');
    const publicEmbedUrl = interaction.fields.getTextInputValue('public_embed_url');

    await checkCalendarConnection(calendarId).catch(() => {
        throw ExpectedCalendarErrors.badId.newId;
    });

    await state.setCalendarId(calendarId);

    if (publicEmbedUrl !== '') {
        try {
            new URL(publicEmbedUrl); // call this constructor to check if URL is valid
        } catch {
            throw ExpectedCalendarErrors.badPublicEmbedUrl;
        }
        // now rawUrl is valid
        await state.setPublicEmbedUrl(publicEmbedUrl);
    } else {
        await state.setPublicEmbedUrl(restorePublicEmbedURL(state?.calendarId));
    }

    server.sendLogMessage(CalendarLogMessages.backedUpToFirebase);
    if (!menuVersion) {
        return CalendarSuccessMessages.updatedCalendarSettings(
            calendarId,
            publicEmbedUrl
        );
    } else {
        return calendarSettingsConfigMenu(server, interaction.channelId ?? '0', false);
    }
}

export { CalendarInteractionExtension };
