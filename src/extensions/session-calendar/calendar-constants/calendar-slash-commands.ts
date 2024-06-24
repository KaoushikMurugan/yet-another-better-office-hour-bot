/** @module SessionCalendar */

import { SlashCommandBuilder } from '@discordjs/builders';
import { ChannelType, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import { CalendarCommandNames } from './calendar-interaction-names.js';

// /when_next [queue_name]
const whenNext = new SlashCommandBuilder()
    .setName(CalendarCommandNames.when_next)
    .setDescription('View the upcoming tutoring hours')
    .addChannelOption(option =>
        option
            .setName('queue_name')
            .setDescription(
                'The course for which you want to view the next tutoring hours'
            )
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildCategory)
    )
    .addBooleanOption(option =>
        option
            .setName('show_all')
            .setDescription(
                'Whether to show ALL the upcoming help sessions of this server. If true, queue_name will be ignored.'
            )
            .setRequired(false)
    );

// /make_calendar_string [calendar_name] [queue_name_1] (queue_name_2) ... (queue_name_n) (user)
/**
 * Generates the make_calendar_string command depending on the number of queues in the server
 * @returns
 */
const makeCalendarStringCommand: SlashCommandOptionsOnlyBuilder = (() => {
    const command = new SlashCommandBuilder()
        .setName(CalendarCommandNames.make_calendar_string)
        .setDescription('Generates a valid calendar string that can be parsed by YABOB')
        .addStringOption(option =>
            option
                .setName('calendar_name')
                .setDescription('Your display name on the calendar')
                .setRequired(true)
        );
    for (let index = 0; index < 20; index++) {
        command.addChannelOption(option =>
            option
                .setName(`queue_name_${index + 1}`)
                .setDescription('The courses you tutor for')
                .setRequired(index === 0) // make the first one required
                .addChannelTypes(ChannelType.GuildCategory)
        );
    }
    command.addUserOption(option =>
        option
            .setName('user')
            .setDescription('The user to modify the calendar string for')
            .setRequired(false)
    );
    return command;
})(); // only called once, so IIFE is gives a cleaner syntax

// /make_calendar_string_all [calendar_name] (user)
const makeCalendarStringAll = new SlashCommandBuilder()
    .setName(CalendarCommandNames.make_calendar_string_all)
    .setDescription('Generates a valid calendar string for all your approved queues')
    .addStringOption(option =>
        option
            .setName('calendar_name')
            .setDescription('Your display name on the calendar')
            .setRequired(true)
    )
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The user to modify the calendar string for')
            .setRequired(false)
    );

const calendarCommands = [
    whenNext.toJSON(),
    makeCalendarStringCommand.toJSON(),
    makeCalendarStringAll.toJSON()
];

export { calendarCommands };
