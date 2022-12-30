/** @module SessionCalendar */

import { SlashCommandBuilder } from '@discordjs/builders';
import { ChannelType } from 'discord.js';
import { CalendarCommandNames } from './calendar-interaction-names.js';

// /set_calendar [calendar_id]
const setCalendar = new SlashCommandBuilder()
    .setName(CalendarCommandNames.set_calendar)
    .setDescription(
        'Commands to modify the resources connected to the /when_next command'
    )
    .addStringOption(option =>
        option
            .setName('calendar_id')
            .setDescription('The link to the calendar')
            .setRequired(true)
    );

// /unset_calendar
const unsetCalendar = new SlashCommandBuilder()
    .setName(CalendarCommandNames.unset_calendar)
    .setDescription(
        'Desyncs the bot from the current calendar and sets it to the default calendar'
    );

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
    );

// /make_calendar_string [calendar_name] [queue_name_1] (queue_name_2) ... (queue_name_n) (user)
/**
 * Generates the make_calendar_string command depending on the number of queues in the server
 * @returns
 */
const makeCalendarStringCommand: Omit<
    SlashCommandBuilder,
    'addSubcommand' | 'addSubcommandGroup'
> = (() => {
    const command = new SlashCommandBuilder()
        .setName(CalendarCommandNames.make_calendar_string)
        .setDescription('Generates a valid calendar string that can be parsed by YABOB')
        .addStringOption(option =>
            option
                .setName('calendar_name')
                .setDescription('Your display name on the calendar')
                .setRequired(true)
        );
    Array(20)
        .fill(undefined)
        .forEach(
            (_, idx) =>
                command.addChannelOption(option =>
                    option
                        .setName(`queue_name_${idx + 1}`)
                        .setDescription('The courses you tutor for')
                        .setRequired(idx === 0)
                        .addChannelTypes(ChannelType.GuildCategory)
                ) // make the first one required
        );
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

// /set_public_embd_url [url] (enable)
const setPublicEmbedUrl = new SlashCommandBuilder()
    .setName(CalendarCommandNames.set_public_embd_url)
    .setDescription('Use another public calendar embed')
    .addStringOption(option =>
        option
            .setName('url')
            .setDescription('The full URL to the public calendar embed')
            .setRequired(true)
    )
    .addBooleanOption(option =>
        option
            .setName('enable')
            .setDescription(
                'Whether to switch to this new public url. ' +
                    'If false, the value in `url` will be ignored'
            )
            .setRequired(true)
    );

const calendarCommands = [
    setCalendar.toJSON(),
    unsetCalendar.toJSON(),
    whenNext.toJSON(),
    makeCalendarStringCommand.toJSON(),
    makeCalendarStringAll.toJSON(),
    setPublicEmbedUrl.toJSON()
];

export { calendarCommands };
