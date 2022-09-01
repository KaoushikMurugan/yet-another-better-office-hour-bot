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
    public override commandMethodMap: ReadonlyMap<
        string,
        (interaction: CommandInteraction) => Promise<string>
    > = new Map([
        ['set_calendar', (interaction: CommandInteraction) => this.updateCalendarId(interaction)]
    ]);

    override get slashCommandData(): CommandData {
        return [
            setCalendar.toJSON()
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
            .then(async successMsg =>
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