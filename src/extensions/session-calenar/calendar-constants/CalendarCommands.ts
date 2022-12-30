/** @module SessionCalendar */
import { EmbedColor } from '../../../utils/embed-helper.js';
import { HelpMessage } from '../../../utils/type-aliases.js';

const setCalendarHelp: HelpMessage = {
    nameValuePair: {
        name: 'set_calendar',
        value: 'set_calendar'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/set_calendar [calendar_id]`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Prompts a modal to set the calendar for the server.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: "`calendar_id: string`\nID of the calendar to set.\
                        \nGo to that particular calendar's Settings and Sharing tab. Scrolling down will take you do the Integrate Calendar Section. \
                        Copy the Calendar ID. It should end with calendar.google.com.",
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/set_calendar 3o2ih5bk35b154@calendar.google.com`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const unsetCalendarHelp: HelpMessage = {
    nameValuePair: {
        name: 'unset_calendar',
        value: 'unset_calendar'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/unset_calendar`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Resets the calendar that YABOB reads from to the default calendar.',
                        inline: false
                    },
                    {
                        name: 'Example Usage',
                        value: '`/unset_calendar`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

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
    }
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
    }
};

const setPublicEmbedUrlHelp: HelpMessage = {
    nameValuePair: {
        name: 'set_public_embed_url',
        value: 'set_public_embed_url'
    },
    useInHelpChannel: true,
    useInHelpCommand: true,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/set_public_embed_url [url]`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Sets the URL that upcoming sessions embed calendar redirects you to.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`url: string`\nA public url to a website which shows the calendar for the server.\
                        \nThis url will be used in the queue embeds to redirect users to the calendar.',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/set_public_embed_url https://supercoolcalendar.com`',
                        inline: true
                    }
                ]
            }
        ]
    }
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
                        \nIf not specified, defauts to current queue if used in a valid queue.',
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
    }
};

const calendarAdminHelpMessages = [
    setCalendarHelp,
    unsetCalendarHelp,
    setPublicEmbedUrlHelp
] as const;

const calendarHelperHelpMessages = [
    makeCalendarStringHelp,
    makeCalendarStringAllHelp
] as const;

const calendarStudentHelpMessages = [whenNextHelp] as const;

export {
    calendarAdminHelpMessages,
    calendarHelperHelpMessages,
    calendarStudentHelpMessages
};
