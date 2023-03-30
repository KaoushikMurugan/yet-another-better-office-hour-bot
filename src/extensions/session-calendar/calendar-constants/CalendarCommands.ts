/** @module SessionCalendar */
import { EmbedColor } from '../../../utils/embed-helper.js';
import { HelpMessage } from '../../../utils/type-aliases.js';

const makeCalendarStringHelp: HelpMessage = {
    nameValuePair: {
        name: 'make_calendar_string',
        value: 'make_calendar_string'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/make_calendar_string [calendar_name] [queue_1] (queue_2) ... (user)`',
                fields: [
                    {
                        name: 'Description',
                        value: "Generates a calendar string to be put in the caller's calendar events. YABOB uses these strings to identify\
                        who is tutoring for what queue. This command will generate a calendar string for the queues specified.",
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`calendar_name: string`\nEnter the name you want to show on the calendar. YABOB will map this to your discord id.\
                    \n`queue_i: Channel`\nThe channel(s) you want to tutor for the event. At least 1 queue must be entered\
                    \n`user: User` (Bot Admin only)\nThe user you want to change the calendar string for',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/make_calendar_string real_name ECS 20 ECS 50`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '📅'
};

const makeCalendarStringAllHelp: HelpMessage = {
    nameValuePair: {
        name: 'make_calendar_string_all',
        value: 'make_calendar_string_all'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/make_calendar_string_all [calendar_name] (user)`',
                fields: [
                    {
                        name: 'Description',
                        value: "Generates a calendar string to be put in the caller's calendar events. YABOB uses these strings to identify\
                        who is tutoring for what queue. This command will generate a string for all the queues you are currently tutoring for.",
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`calendar_name: string`\nEnter the name you want to show on the calendar. YABOB will map this to your discord id.\
                            \n`user: Member` (Bot Admin only)\nThe user you want to change the calendar string for',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/make_calendar_string_all Real Name`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '📅'
};

const whenNextHelp: HelpMessage = {
    nameValuePair: {
        name: 'when_next',
        value: 'when_next'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/when_next`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Shows upcoming help sessions for 1 queue.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`queue_name: string`\n Specifies a queue to list upcoming help sessions for. \
                        \nIf not specified, defaults to current queue if used in a valid queue. \
                        \n`show_all: boolean\n If true, show as many help sessions as discord embed allows.`',
                        inline: false
                    },
                    {
                        name: 'Example Usage',
                        value: '`/when_next`\n `/when_next ECS 140A`',
                        inline: true
                    }
                ]
            }
        ]
    },
    emoji: '📅'
};

const calendarHelperHelpMessages = [
    makeCalendarStringHelp,
    makeCalendarStringAllHelp
] as const;

const calendarStudentHelpMessages = [whenNextHelp] as const;

export { calendarHelperHelpMessages, calendarStudentHelpMessages };
