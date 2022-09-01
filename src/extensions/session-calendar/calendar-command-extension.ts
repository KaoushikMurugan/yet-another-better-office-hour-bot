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
import { google } from "googleapis";
import { OAuth2Client } from "googleapis-common";
import { makeClient } from "./google-auth-helpers";
import { isValidQueueInteraction } from '../../command-handling/common-validations';
import { getUpComingTutoringEvents } from "./calendar-queue-extension";


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

const whenNext = new SlashCommandBuilder() // /when_next (queue_name)
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

class CalendarSwitchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CalendarSwitchError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

class CalendarCommandExtension extends BaseInteractionExtension {
    // I know this is verbose but TS gets angry :(
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
        const newCalendarId = interaction.options.getString('calendar_id', true);
        const newCalendarName = await this.checkCalendarConnection(
            await makeClient(),
            newCalendarId
        ).catch(() => Promise.reject(
            new CalendarSwitchError('This new ID is not valid.')
        ));

        calendarExtensionConfig.YABOB_GOOGLE_CALENDAR_ID = newCalendarId;

        return Promise.resolve(
            `Successfully changed to new calendar` +
            ` ${newCalendarName.length > 0
                ? ` '${newCalendarName}'. `
                : ", but it doesn't have a name. "
            }` +
            `The calendar embed will be refreshed on next render.`
        );
    }

    private async listUpComingHours(interaction: CommandInteraction): Promise<void> {
        const channel = await isValidQueueInteraction(interaction);
        const viewModels = await getUpComingTutoringEvents(
            await makeClient(),
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
        client: OAuth2Client,
        newCalendarId: string
    ): Promise<string> {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const calendar = google.calendar({
            version: 'v3',
            auth: client
        });
        const res = await calendar.events.list({
            calendarId: newCalendarId,
            timeMin: (new Date()).toISOString(),
            timeMax: nextWeek.toISOString(),
            singleEvents: true,
        });
        return res.data.summary ?? '';
    }
}


export { CalendarCommandExtension };