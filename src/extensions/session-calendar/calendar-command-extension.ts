import { BaseInteractionExtension } from '../extension-interface';
import { serverIdCalendarStateMap, CalendarExtensionState } from './calendar-states';
import {
    ButtonInteraction, CategoryChannel, Collection,
    CommandInteraction, Guild, GuildMember, GuildMemberRoleManager, Role, TextBasedChannel
} from 'discord.js';
import { ButtonLogEmbed, EmbedColor, ErrorEmbed, SimpleEmbed, SimpleLogEmbed, SlashCommandLogEmbed } from '../../utils/embed-helper';
import {
    CommandNotImplementedError,
    CommandParseError,
    ExtensionSetupError,
    UserViewableError
} from '../../utils/error-types';
import { CommandData } from '../../command-handling/slash-commands';
import {
    hasValidQueueArgument,
    isTriggeredByUserWithRoles
} from '../../command-handling/common-validations';
import {
    checkCalendarConnection,
    getUpComingTutoringEvents,
    restorePublicEmbedURL,
} from './shared-calendar-functions';
import { FgBlue, FgCyan, FgRed, FgYellow, ResetColor } from '../../utils/command-line-colors';
import { calendarCommands } from './calendar-slash-commands';
import { AttendingServerV2 } from '../../attending-server/base-attending-server';
import { getQueueRoles } from '../../utils/util-functions';
import { appendCalendarHelpMessages } from './CalendarCommands';
import { CalendarConnectionError } from './shared-calendar-functions';
import environment from '../../environment/environment-manager';

class CalendarInteractionExtension extends BaseInteractionExtension {

    protected constructor(
        private readonly guild: Guild
    ) { super(); }

    private static helpEmbedsSent = false;

    static async load(
        guild: Guild,
        serverMap: Collection<string, AttendingServerV2>
    ): Promise<CalendarInteractionExtension> {
        if (environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID.length === 0 ||
            environment.sessionCalendar.YABOB_GOOGLE_API_KEY.length === 0) {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}Make sure you have Calendar ID and API key${ResetColor}`
            ));
        }
        const calendarName = await checkCalendarConnection(environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID)
            .catch(() => Promise.reject(new CalendarConnectionError(
                `The default calendar id is not valid.`
            )));
        serverIdCalendarStateMap.set(
            guild.id,
            await CalendarExtensionState.create(guild.id, guild.name)
        );
        const instance = new CalendarInteractionExtension(guild);
        instance.serverMap = serverMap;
        appendCalendarHelpMessages(CalendarInteractionExtension.helpEmbedsSent);
        CalendarInteractionExtension.helpEmbedsSent = true;
        console.log(
            `[${FgBlue}Session Calendar${ResetColor}] ` +
            `successfully loaded for '${guild.name}'!\n` +
            `- Using ${calendarName} as the default calendar`
        );
        return instance;
    }

    // I know this is very verbose but TS gets angry if I don't write all this :(
    // undefined return values is when the method wants to reply to the interaction directly
    // - If a call returns undefined, processCommand won't edit the reply
    override commandMethodMap: ReadonlyMap<
        string,
        (interaction: CommandInteraction) => Promise<string | undefined>
    > = new Map<string, (interaction: CommandInteraction) => Promise<string | undefined>>([
        ['set_calendar', (interaction: CommandInteraction) =>
            this.updateCalendarId(interaction)],
        ['unset_calendar', (interaction: CommandInteraction) =>
            this.unsetCalendarId(interaction)],
        ['when_next', (interaction: CommandInteraction) =>
            this.listUpComingHours(interaction)],
        ['make_calendar_string', (interaction: CommandInteraction) =>
            this.makeParsableCalendarTitle(interaction, false)],
        ['make_calendar_string_all', (interaction: CommandInteraction) =>
            this.makeParsableCalendarTitle(interaction, true)],
        ['set_public_embd_url', (interaction: CommandInteraction) =>
            this.setPublicEmbedUrl(interaction)],
    ]);

    override buttonMethodMap: ReadonlyMap<
        string,
        (queueName: string, interaction: ButtonInteraction) => Promise<string | undefined>
    > = new Map([
        ['refresh', (queueName: string, interaction: ButtonInteraction) =>
            this.requestCalendarRefresh(queueName, interaction)]
    ]);

    override get slashCommandData(): CommandData {
        return calendarCommands;
    }

    /**
     * Button handler. Almost the same as the built in command-handler.ts
    */
    override async processCommand(interaction: CommandInteraction): Promise<void> {
        //Send logs before* processing the command
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
        ]);
        if (serverId !== undefined) {
            await this.serverMap.get(serverId)?.sendLogMessage(SlashCommandLogEmbed(interaction));
        }
        await interaction.editReply(SimpleEmbed(
            'Processing command...',
            EmbedColor.Neutral
        ));
        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (commandMethod === undefined) {
            await interaction.editReply(
                ErrorEmbed(new CommandNotImplementedError(
                    'This external command does not exist.'
                ))
            );
            return;
        }
        console.log(
            `[${FgCyan}${(new Date).toLocaleString('us-PT')}${ResetColor}] ` +
            `[${FgYellow}${interaction.guild?.name}, ${interaction.guildId}${ResetColor}] ` +
            `User ${interaction.user.username} ` +
            `(${interaction.user.id}) ` +
            `used ${interaction.toString()}`
        );
        await commandMethod(interaction)
            // if the method didn't directly reply, the center handler replies
            .then(async successMsg => successMsg &&
                await interaction.editReply(
                    SimpleEmbed(
                        successMsg,
                        EmbedColor.Success)
                )
            )
            .catch(async (err: UserViewableError) =>
                await interaction.editReply(
                    ErrorEmbed(err)
                )
            );
    }

    /**
     * Button handler. Almost the same as the built in button-handler.ts
    */
    override async processButton(interaction: ButtonInteraction): Promise<void> {
        await interaction.editReply(SimpleEmbed(
            'Processing button...',
            EmbedColor.Neutral
        ));
        const delimiterPosition = interaction.customId.indexOf(' ');
        const buttonName = interaction.customId.substring(0, delimiterPosition);
        const queueName = interaction.customId.substring(delimiterPosition + 1);
        const buttonMethod = this.buttonMethodMap.get(buttonName);
        if (buttonMethod === undefined) {
            await interaction.editReply(ErrorEmbed(
                new CommandNotImplementedError('This external command does not exist.')
            ));
            return;
        }
        console.log(
            `[${FgCyan}${(new Date).toLocaleString('us-PT')}${ResetColor}] ` +
            `[${FgYellow}${interaction.guild?.name}, ${interaction.guildId}${ResetColor}] ` +
            `User ${interaction.user.username} ` +
            `(${interaction.user.id}) ` +
            `pressed [${buttonName}] ` +
            `in queue: ${queueName}.`
        );
        await buttonMethod(queueName, interaction)
            // if the method didn't directly reply, the center handler replies
            .then(async successMsg => successMsg &&
                await interaction.editReply(
                    SimpleEmbed(
                        successMsg,
                        EmbedColor.Success)
                )
            ).catch(async (err: UserViewableError) =>
                await interaction.editReply(
                    ErrorEmbed(err)
                )
            );
    }

    /**
     * Updates the calendar id in the shared calendar extension states
     * ----
     * - Triggers the queue level extensions to update
    */
    private async updateCalendarId(interaction: CommandInteraction): Promise<string> {
        const newCalendarId = interaction.options.getString('calendar_id', true);
        const [newCalendarName] = await Promise.all([
            checkCalendarConnection(
                newCalendarId
            ).catch(() => Promise.reject(
                new CalendarConnectionError('This new calendar ID is not valid.')
            )),
            isTriggeredByUserWithRoles(
                interaction,
                'set_calendar',
                ['Bot Admin']
            )
        ]);
        await serverIdCalendarStateMap
            .get(this.guild.id)
            ?.setCalendarId(newCalendarId);
        await this.serverMap.get(this.guild.id)?.sendLogMessage(SimpleLogEmbed(`Updated calendar ID and stored in firebase`));
        return Promise.resolve(
            `Successfully changed to new calendar` +
            ` ${newCalendarName.length > 0
                ? ` '${newCalendarName}'. `
                : ', but it doesn\'t have a name. '}` +
            `The calendar embeds will refresh soon. ` +
            `Don't forget sure to use \`/set_public_embed_url\` if you are using a 3rd party calendar public embed. ` +
            `This ID has also been backed up to firebase.`
        );
    }

    /**
     * Resets the calendar id to default
     * ----
     */
    private async unsetCalendarId(interaction: CommandInteraction): Promise<string> {
        await isTriggeredByUserWithRoles(
            interaction,
            'unset_calendar',
            ['Bot Admin']
        );
        await serverIdCalendarStateMap
            .get(this.guild.id)
            ?.setCalendarId(environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID);
        await this.serverMap.get(this.guild.id)?.sendLogMessage(SimpleLogEmbed(`Updated calendar ID and stored in firebase`));
        return Promise.resolve(
            `Successfully unset the calendar. ` +
            `The calendar embeds will refresh soon. ` +
            `Or you can manually refresh it using the refresh button.`
        );
    }

    /**
     * Builds the embed for /when_next
     * ----
    */
    private async listUpComingHours(interaction: CommandInteraction): Promise<undefined> {
        const channel = await hasValidQueueArgument(interaction);
        const viewModels = await getUpComingTutoringEvents(
            this.guild.id,
            channel.queueName
        );
        const embed = SimpleEmbed(
            `Upcoming Hours for ${channel.queueName}`,
            EmbedColor.NoColor,
            viewModels.length > 0
                ? viewModels
                    .map(viewModel =>
                        `**${viewModel.discordId !== undefined
                            ? `<@${viewModel.discordId}>`
                            : viewModel.displayName
                        }**\t|\t` +
                        `Start: <t:${viewModel.start.getTime().toString().slice(0, -3)}:R>\t|\t` +
                        `End: <t:${viewModel.end.getTime().toString().slice(0, -3)}:R>`)
                    .join('\n')
                : `There are no upcoming sessions for ${channel.queueName} in the next 7 days.`
        );
        await interaction.editReply(embed)
            .catch(() => console.error(`Edit reply failed with ${interaction.toJSON()}`));
        return undefined;
    }

    /**
     * Makes calendar titles for all approved queues
     * ----
     * @param generateAll whether to generate string for all the queue roles
    */
    private async makeParsableCalendarTitle(
        interaction: CommandInteraction,
        generateAll: boolean
    ): Promise<string> {
        const [serverId] = await Promise.all([
            this.isServerInteraction(interaction),
            isTriggeredByUserWithRoles(
                interaction,
                'make_calendar_string',
                ['Bot Admin', 'Staff']
            )
        ]);
        const calendarDisplayName = interaction.options.getString('calendar_name', true);
        const user = interaction.options.getUser('user', false);
        let validQueues: (CategoryChannel | Role)[] = [];
        let memberToUpdate = interaction.member as GuildMember;
        if (user !== null) {
            const memberRoles = memberToUpdate?.roles as GuildMemberRoleManager;
            // if they are not admin or doesn't have the queue role, reject
            if (!memberRoles.cache
                .some(role => role.name === 'Bot Admin') &&
                user.id !== interaction.user.id
            ) {
                return Promise.reject(new CommandParseError(
                    `Only Bot Admins have permission to update calendar string for users that are not yourself. `
                ));
            } else {
                // already checked in isServerInteraction
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                memberToUpdate = await interaction.guild!.members.fetch(user);
            }
        }
        if (generateAll) {
            validQueues = await getQueueRoles(
                // already checked in isServerInteraction
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.serverMap.get(serverId)!,
                memberToUpdate as GuildMember
            );
        } else {
            const commandArgs = [...this.guild.channels.cache
                .filter(channel => channel.type === 'GUILD_CATEGORY')]
                .map((_, idx) => interaction.options
                    .getChannel(`queue_name_${idx + 1}`, idx === 0))
                .filter(queueArg => queueArg !== undefined && queueArg !== null);
            validQueues = await Promise.all(commandArgs.map(category => {
                if (category?.type !== 'GUILD_CATEGORY' || category === null) {
                    return Promise.reject(new CommandParseError(
                        `\`${category?.name}\` is not a valid queue category.`
                    ));
                }
                const queueTextChannel = category.children
                    .find(child =>
                        child.name === 'queue' &&
                        child.type === 'GUILD_TEXT');
                if (queueTextChannel === undefined) {
                    return Promise.reject(new CommandParseError(
                        `'${category.name}' does not have a \`#queue\` text channel.`
                    ));
                }
                return Promise.resolve(category);
            }));
        }
        await serverIdCalendarStateMap
            .get(this.guild.id)
            ?.updateNameDiscordIdMap(
                calendarDisplayName,
                memberToUpdate.id
            );
        await this.serverMap.get(this.guild.id)?.sendLogMessage(SimpleLogEmbed(`Updated calendar Name-ID Map and stored in firebase`));
        return Promise.resolve(
            `Copy and paste the following into the calendar **description**:\n\n` +
            `YABOB_START ` +
            `${calendarDisplayName} - ` +
            `${validQueues.map(queue => queue.name).join(', ')} ` +
            `YABOB_END\n`
        );
    }

    private async setPublicEmbedUrl(
        interaction: CommandInteraction
    ): Promise<string> {
        const rawUrl = interaction.options.getString('url', true);
        const enable = interaction.options.getBoolean('enable', true);
        await isTriggeredByUserWithRoles(
            interaction,
            'set_calendar',
            ['Bot Admin']
        );
        if (enable) {
            try {
                // call this constructor to check if URL is valid
                new URL(rawUrl);
            } catch {
                return Promise.reject(new CommandParseError('Please provide a valid and complete URL.'));
            }
            // now rawUrl is valid
            await serverIdCalendarStateMap.get(this.guild.id)?.setPublicEmbedUrl(rawUrl);
            return `Successfullt changed the public embed url. The links in the titles of calendar queue embed will refresh soon.`;
        } else {
            const state = serverIdCalendarStateMap.get(this.guild.id);
            await state?.setPublicEmbedUrl(restorePublicEmbedURL(state?.calendarId));
            return `Successfullt changed to default embed url. The links in the titles of calendar queue embed will refresh soon.`;
        }
    }

    private async requestCalendarRefresh(
        queueName: string,
        interaction: ButtonInteraction
    ): Promise<string> {
        const queueChannel = serverIdCalendarStateMap
            .get(this.guild.id)
            ?.listeners
            .get(queueName);
        await this.serverMap.get(this.guild.id)?.sendLogMessage(ButtonLogEmbed(
            interaction.user,
            `Refresh Upcoming Sessions`,
            interaction.channel as TextBasedChannel,
        ));
        await queueChannel?.onCalendarExtensionStateChange();
        return `Successfully refreshed upcoming hours for ${queueName}`;
    }

    private async isServerInteraction(
        interaction: CommandInteraction
    ): Promise<string> {
        const serverId = interaction.guild?.id;
        if (!serverId || !this.serverMap.has(serverId)) {
            return Promise.reject(new CommandParseError(
                'I can only accept server based interactions. '
                + `Are you sure ${interaction.guild?.name} has a initialized YABOB?`));
        } else {
            return serverId;
        }
    }
}

export { CalendarInteractionExtension, CalendarConnectionError };