/** @module SessionCalendar */
import { BaseInteractionExtension, IInteractionExtension } from '../extension-interface.js';
import { CalendarExtensionState, calendarStates } from './calendar-states.js';
import {
    ButtonInteraction,
    CategoryChannel,
    ChannelType,
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
    SimpleEmbed,
    SlashCommandLogEmbed
} from '../../utils/embed-helper.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { CommandData } from '../../command-handling/slash-commands.js';
import {
    hasValidQueueArgument,
    isTriggeredByUserWithRolesSync
} from '../../command-handling/common-validations.js';
import {
    checkCalendarConnection,
    composeUpcomingSessionsEmbedBody,
    getUpComingTutoringEvents,
    restorePublicEmbedURL,
    isServerCalendarInteraction
} from './shared-calendar-functions.js';
import { blue, red, yellow } from '../../utils/command-line-colors.js';
import { calendarCommands } from './calendar-slash-commands.js';
import {
    getQueueRoles,
    logButtonPress,
    logSlashCommand
} from '../../utils/util-functions.js';
import { appendCalendarHelpMessages } from './CalendarCommands.js';
import {
    ButtonCallback,
    CommandCallback,
    ModalSubmitCallback,
    YabobEmbed
} from '../../utils/type-aliases.js';
import { ExpectedCalendarErrors } from './expected-calendar-errors.js';
import { ExpectedParseErrors } from '../../command-handling/expected-interaction-errors.js';
import { environment } from '../../environment/environment-manager.js';
import {
    CalendarLogMessages,
    CalendarSuccessMessages
} from './calendar-success-messages.js';

class CalendarInteractionExtension
    extends BaseInteractionExtension
    implements IInteractionExtension
{
    protected constructor() {
        super();
    }

    private static helpEmbedsSent = false;

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
        calendarStates.set(
            guild.id,
            await CalendarExtensionState.load(guild)
        );
        const instance = new CalendarInteractionExtension();
        appendCalendarHelpMessages(CalendarInteractionExtension.helpEmbedsSent);
        CalendarInteractionExtension.helpEmbedsSent = true;
        console.log(
            `[${blue('Session Calendar')}] ` +
                `successfully loaded for '${guild.name}'!\n` +
                ` - Using ${yellow(calendarName)} as the default calendar`
        );
        return instance;
    }

    // Undefined return values is when the method wants to reply to the interaction directly
    // - If a call returns undefined, processCommand won't edit the reply
    private commandMethodMap: { [commandName: string]: CommandCallback } = {
        set_calendar: this.updateCalendarId,
        unset_calendar: this.unsetCalendarId,
        when_next: this.listUpComingHours,
        make_calendar_string: interaction =>
            this.makeParsableCalendarTitle(interaction, false),
        make_calendar_string_all: interaction =>
            this.makeParsableCalendarTitle(interaction, true),
        set_public_embd_url: this.setPublicEmbedUrl
    } as const;

    private buttonMethodMap: { [buttonName: string]: ButtonCallback } = {
        refresh: this.requestCalendarRefresh
    } as const;

    private modalMethodMap: { [modalName: string]: ModalSubmitCallback } = {} as const;

    override get slashCommandData(): CommandData {
        return calendarCommands;
    }

    override canHandleButton(interaction: ButtonInteraction): boolean {
        const [buttonName] = this.splitButtonQueueName(interaction);
        return buttonName in this.buttonMethodMap;
    }

    override canHandleCommand(interaction: ChatInputCommandInteraction): boolean {
        return interaction.commandName in this.commandMethodMap;
    }

    override canHandleModalSubmit(interaction: ModalSubmitInteraction): boolean {
        return interaction.customId in this.modalMethodMap;
    }

    override async processCommand(
        interaction: ChatInputCommandInteraction
    ): Promise<void> {
        //Send logs before* processing the command
        const [server] = isServerCalendarInteraction(interaction);
        await Promise.all<unknown>([
            interaction.reply({
                ...SimpleEmbed(
                    `Processing command \`${interaction.commandName}\` ...`,
                    EmbedColor.Neutral
                ),
                ephemeral: true
            }),
            server.sendLogMessage(SlashCommandLogEmbed(interaction))
        ]);
        const commandMethod = this.commandMethodMap[interaction.commandName];
        logSlashCommand(interaction);
        commandMethod?.(interaction)
            .then(successMessage => interaction.editReply(successMessage))
            .catch(async err =>
                interaction.replied
                    ? await interaction.editReply(ErrorEmbed(err))
                    : await interaction.reply({ ...ErrorEmbed(err), ephemeral: true })
            );
    }

    override async processButton(interaction: ButtonInteraction): Promise<void> {
        const [buttonName, queueName] = this.splitButtonQueueName(interaction);
        const buttonMethod = this.buttonMethodMap[buttonName];
        await interaction.reply({
            ...SimpleEmbed(
                `Processing button \`${buttonName}\` in \`${queueName}\` ...`,
                EmbedColor.Neutral
            ),
            ephemeral: true
        });
        logButtonPress(interaction, buttonName, queueName);
        buttonMethod?.(queueName, interaction)
            .then(successMessage => interaction.editReply(successMessage))
            .catch(async err =>
                interaction.replied
                    ? await interaction.editReply(ErrorEmbed(err))
                    : await interaction.reply({ ...ErrorEmbed(err), ephemeral: true })
            );
    }
    /**
     * Seperates the button name and queue name from the button interaction custom id
     * @param interaction
     * @returns [buttonName, queueName]
     */
    private splitButtonQueueName(
        interaction: ButtonInteraction
    ): [buttonName: string, queueName: string] {
        const delimiterPosition = interaction.customId.indexOf(' ');
        const buttonName = interaction.customId.substring(0, delimiterPosition);
        const queueName = interaction.customId.substring(delimiterPosition + 1);
        return [buttonName, queueName];
    }

    /**
     * The `/set_calendar [calendar_id]` command
     *
     * Updates the calendar id in the shared calendar extension states
     * - Triggers the queue level extensions to update
     */
    private async updateCalendarId(
        interaction: ChatInputCommandInteraction
    ): Promise<YabobEmbed> {
        const newCalendarId = interaction.options.getString('calendar_id', true);
        const [newCalendarName] = [
            await checkCalendarConnection(newCalendarId).catch(() => {
                throw ExpectedCalendarErrors.badId.newId;
            }),
            isTriggeredByUserWithRolesSync(interaction, 'set_calendar', ['Bot Admin'])
        ];
        const [server, state] = isServerCalendarInteraction(interaction);
        await Promise.all([
            state.setCalendarId(newCalendarId),
            server.sendLogMessage(CalendarLogMessages.backedUpToFirebase)
        ]);
        return CalendarSuccessMessages.updatedCalendarId(newCalendarName);
    }

    /**
     * The `/unset_calendar` command
     *
     * Resets the calendar id to default
     */
    private async unsetCalendarId(
        interaction: ChatInputCommandInteraction
    ): Promise<YabobEmbed> {
        const [server, state] = isServerCalendarInteraction(interaction);
        isTriggeredByUserWithRolesSync(interaction, 'unset_calendar', ['Bot Admin']);
        await Promise.all([
            state.setCalendarId(environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID),
            server.sendLogMessage(CalendarLogMessages.backedUpToFirebase)
        ]);
        return CalendarSuccessMessages.unsetCalendar;
    }

    /**
     * The `/when_next` command
     *
     * Builds the embed for /when_next
     */
    private async listUpComingHours(
        interaction: ChatInputCommandInteraction
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
    private async makeParsableCalendarTitle(
        interaction: ChatInputCommandInteraction,
        generateAll: boolean
    ): Promise<YabobEmbed> {
        const [server, state] = isServerCalendarInteraction(interaction);
        const member = isTriggeredByUserWithRolesSync(
            interaction,
            'make_calendar_string',
            ['Bot Admin', 'Staff']
        );
        const calendarDisplayName = interaction.options.getString('calendar_name', true);
        const user = interaction.options.getUser('user', false);
        let validQueues: (CategoryChannel | Role)[] = [];
        let memberToUpdate = member;

        if (user !== null) {
            const memberRoles = memberToUpdate.roles;
            // if they are not admin or doesn't have the queue role, reject
            if (
                !memberRoles.cache.some(role => role.name === 'Bot Admin') &&
                user.id !== interaction.user.id
            ) {
                throw ExpectedCalendarErrors.nonAdminMakingCalendarStringForOthers;
            } else {
                memberToUpdate = await server.guild.members.fetch(user);
            }
        }
        if (generateAll) {
            validQueues = await getQueueRoles(server, memberToUpdate);
        } else {
            const commandArgs = [
                ...server.guild.channels.cache.filter(
                    channel => channel.type === ChannelType.GuildCategory
                )
            ]
                .map((_, idx) =>
                    interaction.options.getChannel(`queue_name_${idx + 1}`, idx === 0)
                )
                .filter(queueArg => queueArg !== undefined && queueArg !== null);
            validQueues = commandArgs.map(category => {
                if (category?.type !== ChannelType.GuildCategory || category === null) {
                    throw ExpectedParseErrors.invalidQueueCategory(category?.name);
                }
                const queueTextChannel = (
                    category as CategoryChannel
                ).children.cache.find(
                    child =>
                        child.name === 'queue' && child.type === ChannelType.GuildText
                );
                if (queueTextChannel === undefined) {
                    throw ExpectedParseErrors.noQueueTextChannel(category.name);
                }
                return category as CategoryChannel;
            });
        }
        void state
            .updateNameDiscordIdMap(calendarDisplayName, memberToUpdate.user.id)
            .catch(() =>
                console.error(
                    `Calendar refresh timed out from ${red(
                        'updateNameDiscordIdMap'
                    )} triggered by ${memberToUpdate.displayName}`
                )
            );
        await server.sendLogMessage(CalendarLogMessages.backedUpToFirebase);
        return CalendarSuccessMessages.completedCalendarString(
            calendarDisplayName,
            validQueues.map(queue => queue.name)
        );
    }

    /**
     * The `/set_public_embd_url` command
     *
     * Sets the public embed url for the server's calendar
     * @param interaction
     */
    private async setPublicEmbedUrl(
        interaction: ChatInputCommandInteraction
    ): Promise<YabobEmbed> {
        const [, state] = isServerCalendarInteraction(interaction);
        const rawUrl = interaction.options.getString('url', true);
        const enable = interaction.options.getBoolean('enable', true);
        isTriggeredByUserWithRolesSync(interaction, 'set_calendar', ['Bot Admin']);
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
     * @returns
     */
    private async requestCalendarRefresh(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<YabobEmbed> {
        const [server, state] = isServerCalendarInteraction(interaction);
        const queueLevelExtension = state.listeners.get(queueName);
        await Promise.all<unknown>([
            server.sendLogMessage(
                ButtonLogEmbed(
                    interaction.user,
                    `Refresh Upcoming Sessions`,
                    interaction.channel as TextBasedChannel
                )
            ),
            queueLevelExtension?.onCalendarExtensionStateChange()
        ]);
        return CalendarSuccessMessages.refreshSuccess(queueName);
    }
}

export { CalendarInteractionExtension };
