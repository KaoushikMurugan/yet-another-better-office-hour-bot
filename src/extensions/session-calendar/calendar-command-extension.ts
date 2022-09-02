import { BaseInteractionExtension } from "../extension-interface";
import { calendarExtensionConfig } from './calendar-config';
import { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedColor, ErrorEmbed, SimpleEmbed } from "../../utils/embed-helper";
import {
    CommandNotImplementedError,
    UserViewableError
} from "../../utils/error-types";
import { CommandData } from '../../command-handling/slash-commands';
import {
    isValidQueueInteraction,
    isTriggeredByUserWithRoles
} from '../../command-handling/common-validations';
import { getUpComingTutoringEvents, buildCalendarURL } from "./calendar-queue-extension";
import { calendar_v3 } from "googleapis";


const setCalendar = new SlashCommandBuilder()
    .setName("set_calendar")
    .setDescription(
        "Commands to modify the resources connected to the /when_next command"
    )
    .addStringOption((option) =>
        option
            .setName("calendar_id")
            .setDescription("The link to the calendar")
            .setRequired(true)
    );

const whenNext = new SlashCommandBuilder()
    .setName("when_next")
    .setDescription("View the upcoming tutoring hours")
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription(
                "The course for which you want to view the next tutoring hours"
            )
            .setRequired(false)
    );

class CalendarConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CalendarConnectionError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

class CalendarCommandExtension extends BaseInteractionExtension {
    // I know this is verbose but TS gets angry if I don't write all this:(
    public override commandMethodMap: ReadonlyMap<
        string,
        (interaction: CommandInteraction) => Promise<string | void>
    > = new Map<string, (interaction: CommandInteraction) => Promise<string | void>>([
        ['set_calendar', (interaction: CommandInteraction) => this.updateCalendarId(interaction)],
        ['when_next', (interaction: CommandInteraction) => this.listUpComingHours(interaction)]
    ]);

    override get slashCommandData(): CommandData {
        return [
            setCalendar.toJSON(),
            whenNext.toJSON()
        ];
    }

    override async processCommand(interaction: CommandInteraction): Promise<void> {
        await interaction.reply({
            ...SimpleEmbed(
                'Processing command...',
                EmbedColor.Neutral
            ),
            ephemeral: true
        });
        const commandMethod = this.commandMethodMap.get(interaction.commandName);
        if (commandMethod === undefined) {
            await interaction.editReply(ErrorEmbed(
                new CommandNotImplementedError('This external command does not exist.')
            ));
            return;
        }
        await commandMethod(interaction)
            // if the method didn't directly reply, the center handler replies
            .then(async successMsg => successMsg &&
                await interaction.editReply(
                    SimpleEmbed(
                        successMsg,
                        EmbedColor.Success)
                ))
            .catch(async (err: UserViewableError) =>
                await interaction.editReply(
                    ErrorEmbed(err)
                ));
    }

    private async updateCalendarId(interaction: CommandInteraction): Promise<string> {
        await isTriggeredByUserWithRoles(
            interaction,
            "set_calendar",
            ["Admin"]
        );

        const newCalendarId = interaction.options.getString('calendar_id', true);
        const newCalendarName = await this.checkCalendarConnection(
            newCalendarId
        ).catch(() => Promise.reject(
            new CalendarConnectionError('This new ID is not valid.')
        ));

        // runtime only. Will be resetted when YABOB restarts
        calendarExtensionConfig.YABOB_GOOGLE_CALENDAR_ID = newCalendarId;

        return Promise.resolve(
            `Successfully changed to new calendar` +
            ` ${newCalendarName.length > 0
                ? ` '${newCalendarName}'. `
                : ", but it doesn't have a name. "
            }` +
            `The calendar embed will be refreshed on next queue periodic update.`
        );
    }

    private async listUpComingHours(interaction: CommandInteraction): Promise<void> {
        const channel = await isValidQueueInteraction(interaction);
        const viewModels = await getUpComingTutoringEvents(
            channel.queueName
        );

        const embed = SimpleEmbed(
            `Upcoming Hours for ${channel.queueName}`,
            EmbedColor.NoColor,
            viewModels.length > 0
                ? viewModels
                    .map(viewModel => `**${viewModel.displayName}**\t|\t` +
                        `Start: <t:${viewModel.start.getTime().toString().slice(0, -3)}:R>\t|\t` +
                        `End: <t:${viewModel.end.getTime().toString().slice(0, -3)}:R>`)
                    .join('\n')
                : `There are no upcoming sessions for ${channel.queueName} in the next 7 days.`
        );

        await interaction.editReply(embed);
    }

    private async checkCalendarConnection(
        newCalendarId: string
    ): Promise<string> {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const url = buildCalendarURL({
            calendarId: newCalendarId,
            timeMin: new Date(),
            timeMax: nextWeek,
            apiKey: calendarExtensionConfig.YABOB_GOOGLE_API_KEY
        });

        const response = await fetch(url);
        if (response.status !== 200) {
            return Promise.reject('Calendar request failed.');
        }
        const responseJSON = response.json();

        return (responseJSON as calendar_v3.Schema$Events).summary ?? '';
    }
}


export { CalendarCommandExtension };