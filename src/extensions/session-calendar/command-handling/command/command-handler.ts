import { CategoryChannel, ChatInputCommandInteraction, Role } from 'discord.js';
import {
    hasValidQueueArgument,
    isTriggeredByMemberWithRoles
} from '../../../../command-handling/common-validations.js';
import { ExpectedParseErrors } from '../../../../command-handling/expected-interaction-errors.js';
import { environment } from '../../../../environment/environment-manager.js';
import { red } from '../../../../utils/command-line-colors.js';
import {
    SimpleEmbed,
    EmbedColor,
    SlashCommandLogEmbed,
    ErrorEmbed
} from '../../../../utils/embed-helper.js';
import { CommandCallback, YabobEmbed } from '../../../../utils/type-aliases.js';
import {
    getQueueRoles,
    isCategoryChannel,
    isQueueTextChannel,
    logSlashCommand
} from '../../../../utils/util-functions.js';
import type { CalendarInteractionExtension } from '../../calendar-command-extension.js';
import { ExpectedCalendarErrors } from '../../expected-calendar-errors.js';
import {
    checkCalendarConnection,
    composeUpcomingSessionsEmbedBody,
    getUpComingTutoringEvents,
    isServerCalendarInteraction,
    restorePublicEmbedURL
} from '../../shared-calendar-functions.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from '../calendar-success-messages.js';

const commandMethodMap: { [commandName: string]: CommandCallback } = {
    set_calendar: updateCalendarId,
    unset_calendar: unsetCalendarId,
    when_next: listUpComingHours,
    make_calendar_string: interaction => makeParsableCalendarTitle(interaction, false),
    make_calendar_string_all: interaction => makeParsableCalendarTitle(interaction, true),
    set_public_embd_url: setPublicEmbedUrl
} as const;

// #region

function canHandleCalendarCommand(
    this: CalendarInteractionExtension,
    interaction: ChatInputCommandInteraction): boolean {
    return interaction.commandName in commandMethodMap;
}

async function processCalendarCommand(
    this: CalendarInteractionExtension,
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
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

// #endregion

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
    const newCalendarName = await checkCalendarConnection(newCalendarId).catch(() => {
        throw ExpectedCalendarErrors.badId.newId;
    });
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
        const noPermission =
            !memberRoles.cache.some(role => role.id === server.botAdminRoleID) &&
            userOption.id !== interaction.user.id;
        if (noPermission) {
            throw ExpectedCalendarErrors.nonAdminMakingCalendarStringForOthers;
        }
        memberToUpdate = await server.guild.members.fetch(userOption);
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

export { canHandleCalendarCommand, processCalendarCommand };
