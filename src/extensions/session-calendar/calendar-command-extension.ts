import { BaseInteractionExtension } from "../extension-interface";
import { serverIdCalendarStateMap, CalendarExtensionState } from './calendar-states';
import {
    ButtonInteraction, CategoryChannel, Collection,
    CommandInteraction, Guild, GuildMember, GuildMemberRoleManager, Role
} from 'discord.js';
import { EmbedColor, ErrorEmbed, SimpleEmbed } from "../../utils/embed-helper";
import {
    CommandNotImplementedError,
    CommandParseError,
    UserViewableError
} from "../../utils/error-types";
import { CommandData } from '../../command-handling/slash-commands';
import {
    hasValidQueueArgument,
    isTriggeredByUserWithRoles
} from '../../command-handling/common-validations';
import {
    checkCalendarConnection,
    getUpComingTutoringEvents,
} from './shared-calendar-functions';
import { FgCyan, FgYellow, ResetColor } from "../../utils/command-line-colors";
import { calendarCommands } from './calendar-slash-commands';

import { AttendingServerV2 } from "../../attending-server/base-attending-server";
import { getQueueRoles } from "../../utils/util-functions";
import { appendCalendarHelpEmbeds } from './CalendarCommands';
import { CalendarConnectionError } from './shared-calendar-functions';


class CalendarInteractionExtension extends BaseInteractionExtension {

    protected constructor(
        private readonly guild: Guild
    ) { super(); }

    static helpEmbedsSent = false;

    static async load(
        guild: Guild,
        serverMap: Collection<string, AttendingServerV2>
    ): Promise<CalendarInteractionExtension> {
        serverIdCalendarStateMap.set(
            guild.id,
            await CalendarExtensionState.load(guild.id, guild.name)
        );
        const instance = new CalendarInteractionExtension(guild);
        instance.serverMap = serverMap;
        appendCalendarHelpEmbeds(CalendarInteractionExtension.helpEmbedsSent);
        CalendarInteractionExtension.helpEmbedsSent = true;
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
        ['when_next', (interaction: CommandInteraction) =>
            this.listUpComingHours(interaction)],
        ['make_calendar_string', (interaction: CommandInteraction) =>
            this.makeParsableCalendarTitle(interaction, false)],
        ['make_calendar_string_all', (interaction: CommandInteraction) =>
            this.makeParsableCalendarTitle(interaction, true)]
    ]);

    override buttonMethodMap: ReadonlyMap<
        string,
        (interaction: ButtonInteraction, queueName: string) => Promise<string | undefined>
    > = new Map([
        ['refresh', (_: ButtonInteraction, queueName: string) =>
            this.requestCalendarRefresh(queueName)]
    ]);

    override get slashCommandData(): CommandData {
        return calendarCommands;
    }

    /**
     * Button handler. Almost the same as the built in command-handler.ts
    */
    override async processCommand(interaction: CommandInteraction): Promise<void> {
        const logEditFailure = () => console.error(`Edit reply failed with ${interaction.toJSON()}`);
        await interaction.reply({
            ...SimpleEmbed(
                'Processing command...',
                EmbedColor.Neutral
            ),
            ephemeral: true
        });
        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (commandMethod === undefined) {
            await interaction.editReply(
                ErrorEmbed(new CommandNotImplementedError(
                    'This external command does not exist.'
                ))
            ).catch(logEditFailure);
            return;
        }
        console.log(
            `[${FgCyan}${(new Date).toLocaleString()}${ResetColor}] ` +
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
                ).catch(logEditFailure)
            )
            .catch(async (err: UserViewableError) =>
                await interaction.editReply(
                    ErrorEmbed(err)
                ).catch(logEditFailure)
            );
    }

    /**
     * Button handler. Almost the same as the built in button-handler.ts
    */
    override async processButton(interaction: ButtonInteraction): Promise<void> {
        const logEditFailure = () => console.error(`Edit reply failed with ${interaction.toJSON()}`);
        await interaction.reply({
            ...SimpleEmbed(
                'Processing button...',
                EmbedColor.Neutral
            ),
            ephemeral: true
        });
        const delimiterPosition = interaction.customId.indexOf(" ");
        const interactionName = interaction.customId.substring(0, delimiterPosition);
        const queueName = interaction.customId.substring(delimiterPosition + 1);
        const buttonMethod = this.buttonMethodMap.get(interactionName);
        if (buttonMethod === undefined) {
            await interaction.editReply(ErrorEmbed(
                new CommandNotImplementedError('This external command does not exist.')
            ));
            return;
        }
        console.log(
            `[${FgCyan}${(new Date).toLocaleString()}${ResetColor}] ` +
            `[${FgYellow}${interaction.guild?.name}, ${interaction.guildId}${ResetColor}] ` +
            `User ${interaction.user.username} ` +
            `(${interaction.user.id}) ` +
            `pressed [${interactionName}] ` +
            `in queue: ${queueName}.`
        );
        await buttonMethod(interaction, queueName)
            // if the method didn't directly reply, the center handler replies
            .then(async successMsg => successMsg &&
                await interaction.editReply(
                    SimpleEmbed(
                        successMsg,
                        EmbedColor.Success)
                ).catch(logEditFailure)
            ).catch(async (err: UserViewableError) =>
                await interaction.editReply(
                    ErrorEmbed(err)
                ).catch(logEditFailure)
            );
    }

    /**
     * Updates the calendar id in the shared calendar extension states
     * - triggers the queue level extensions to update
     * 
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
                "set_calendar",
                ['Bot Admin']
            )
        ]);
        await serverIdCalendarStateMap.get(this.guild.id)?.setCalendarId(newCalendarId);
        await Promise.all(
            serverIdCalendarStateMap
                .get(this.guild.id)
                ?.listeners
                .map(listener => listener.onCalendarExtensionStateChange()) ?? []
        );
        return Promise.resolve(
            `Successfully changed to new calendar` +
            ` ${newCalendarName.length > 0
                ? ` '${newCalendarName}'. `
                : ", but it doesn't have a name. "}` +
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
                "make_calendar_string",
                ['Bot Admin', 'Staff']
            )
        ]);
        const calendarDisplayName = interaction.options.getString('your_name', true);
        let validQueues: (CategoryChannel | Role)[] = [];

        let memberToUpdate = interaction.member as GuildMember;

        const user = interaction.options.getUser('user', false);
        if (user !== null) {
            const memberRoles = memberToUpdate?.roles as GuildMemberRoleManager;
            // if they are not admin or doesn't have the queue role, reject
            if (!memberRoles.cache
                .some(role => role.name === 'Bot Admin') || 
                user.id === interaction.user.id
            ) {
                return Promise.reject(new CommandParseError(
                    `Only Bot Admins have permission to update calendar string for users that are not yourself. `
                ));
            } else {
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
                memberToUpdate!.id
            );
        await Promise.all(serverIdCalendarStateMap.get(this.guild.id)?.listeners
            .map(listener => listener.onCalendarExtensionStateChange()) ?? []);
        return Promise.resolve(
            `Copy and paste the following into the calendar **description**.:\n\n` +
            `YABOB_START ` +
            `${calendarDisplayName} - ` +
            `${validQueues.map(queue => queue.name).join(', ')} ` +
            `YABOB_END\n`
        );
    }

    private async requestCalendarRefresh(queueName: string): Promise<string> {
        await serverIdCalendarStateMap
            .get(this.guild.id)
            ?.listeners
            .get(queueName)
            ?.onCalendarExtensionStateChange();
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