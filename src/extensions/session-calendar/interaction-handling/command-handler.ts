import {
    ChatInputCommandInteraction,
    CategoryChannel,
    Role,
    EmbedBuilder
} from 'discord.js';
import { CommandHandlerProps } from '../../../interaction-handling/handler-interface.js';
import { red } from '../../../utils/command-line-colors.js';
import { EmbedColor } from '../../../utils/embed-helper.js';
import {
    getQueueRoles,
    isCategoryChannel,
    isQueueTextChannel
} from '../../../utils/util-functions.js';
import { CalendarCommandNames } from '../calendar-constants/calendar-interaction-names.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from '../calendar-constants/calendar-success-messsages.js';
import { ExpectedCalendarErrors } from '../calendar-constants/expected-calendar-errors.js';
import { composeUpcomingSessionsEmbedBody } from '../shared-calendar-functions.js';
import { ExpectedParseErrors } from '../../../interaction-handling/interaction-constants/expected-interaction-errors.js';
import {
    isTriggeredByMemberWithRoles,
    hasValidQueueArgument
} from '../../../interaction-handling/shared-validations.js';
import { AttendingServerV2 } from '../../../attending-server/base-attending-server.js';
import { CalendarExtensionState } from '../calendar-states.js';

const calendarCommandMap: CommandHandlerProps = {
    methodMap: {
        [CalendarCommandNames.when_next]: listUpComingHours,
        [CalendarCommandNames.make_calendar_string]: interaction =>
            makeParsableCalendarTitle(interaction, false),
        [CalendarCommandNames.make_calendar_string_all]: interaction =>
            makeParsableCalendarTitle(interaction, true)
    },
    skipProgressMessageCommands: new Set()
};

/**
 * The `/when_next` command, builds the embed for /when_next
 * @param interaction interaction object
 * @param showAll whether to show all the upcoming sessions of this server
 * - if false, show the sessions of the parent queue category
 */
async function listUpComingHours(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const state = CalendarExtensionState.get(interaction.guildId);
    await state.refreshCalendarEvents();
    const showAll = interaction.options.getBoolean('show_all');
    const title = showAll // idk what to call this, but it's either the guild name or the target queue's queueName
        ? server.guild.name
        : hasValidQueueArgument(interaction).queueName;
    const viewModels = showAll // if not showAll, filter out the view models that match the queue name
        ? state.upcomingSessions
        : state.upcomingSessions.filter(viewModel => viewModel.queueName === title);
    const embed = new EmbedBuilder()
        .setTitle(`Upcoming Hours for ${title}`)
        .setColor(EmbedColor.Blue)
        .setDescription(
            composeUpcomingSessionsEmbedBody(
                viewModels,
                title,
                state.lastUpdatedTimeStamp,
                'max'
            )
        )
        .setFooter({
            text: 'Due to the length limit, some help sessions might not be shown.'
        });
    await interaction.editReply({ embeds: [embed.data] });
}

/**
 * The `/make_calendar_string` and `/make_calendar_string_all` commands
 * Makes calendar titles for all approved queues
 * @param generateAll whether to generate string for all the queue roles
 */
async function makeParsableCalendarTitle(
    interaction: ChatInputCommandInteraction<'cached'>,
    generateAll: boolean
): Promise<void> {
    const server = AttendingServerV2.get(interaction.guildId);
    const state = CalendarExtensionState.get(interaction.guildId);
    const member = isTriggeredByMemberWithRoles(
        server,
        interaction.member,
        'make_calendar_string',
        'staff'
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
    await interaction.editReply(
        CalendarSuccessMessages.completedCalendarString(
            calendarDisplayName,
            validQueueOptions.map(queue => queue.name)
        )
    );
}

export { calendarCommandMap };
