import { BaseInteractionExtension } from "../extension-interface";
import { calendarExtensionConfig } from './calendar-config';
import { CacheType, CommandInteraction, Guild } from 'discord.js';
import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/rest/v9';
import { EmbedColor, ErrorEmbed, SimpleEmbed } from "../../utils/embed-helper";
import { CommandNotImplementedError, UserViewableError } from "../../utils/error-types";
import { FgBlue, ResetColor } from "../../utils/command-line-colors";
import { CommandData } from '../../command-handling/slash-commands';

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

    override async processCommand(interaction: CommandInteraction<CacheType>): Promise<void> {
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

    private updateCalendarId(interaction: CommandInteraction): Promise<string> {
        // calendarExtensionConfig.YABOB_GOOGLE_CALENDAR_ID = newCalendarId;
        const newCalendarId = interaction.options.getString('calendar_id', true);
        
        // TODO: validate calendarId here by calling the api
        return Promise.resolve("Successfully changed to new calendar");
    }
}


export { CalendarCommandExtension };