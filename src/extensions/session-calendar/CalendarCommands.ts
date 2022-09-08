import { MessageOptions } from "discord.js";
import { EmbedColor } from "../../utils/embed-helper";

const adminCommandsEmbed: Pick<MessageOptions, "embeds">[] = [
    { embeds : [{
        color: EmbedColor.NoColor,
        title: 'Command: `/enqueue [queue_name]`',
        fields: [
            {
                name: 'Description',
                value: 'Adds sender to the back of the queue `queue_name`',
                inline: false
            },
            {
                name: 'Options',
                value: "None",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/enqueue ECS32A`',
                inline: true
            },
        ]
    }]},
];

export const helperCommandsEmbed: Pick<MessageOptions, "embeds">[] = [
    { embeds : [{
        color: EmbedColor.NoColor,
        title: 'Command: `/make_calendar_string [displayName] (queue_1) (queue_2) ...`',
        fields: [
            {
                name: 'Description',
                value: 'Generates a calendar summary (aka title) that the bot will recognize',
                inline: false
            },
            {
                name: 'Options',
                value: "`displayName: string`\nEnter the name you want to show on the calendar. YABOB will map this to your discord id.\n\
                `queue_i: Channel`\nThe channel(s) you want to tutor for the event",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/make_calendar_string real_name ECS 20 ECS 50`',
                inline: true
            },
        ]
    }]},
];

export const studentCommandsEmbed: Pick<MessageOptions, "embeds">[] = [
    { embeds : [{
        color: EmbedColor.NoColor,
        title: 'Command: `/set_calendar [calendar_id]`',
        fields: [
            {
                name: 'Description',
                value: 'Changes the calendar that YABOB reads from.',
                inline: false
            },
            {
                name: 'Options',
                value: "`calendar_id: string`\nGo to that particular calendar's Settings and Sharing tab.\
                Scrolling down will take you do the Integrate Calendar Section. Copy the Calendar ID. It should end with calendar.google.com.",
                inline: true
            },
            { name: '\u0002', value: '\u0002', inline: true },
            {
                name: 'Example Usage',
                value: '`/set_calendar qwerty12345@calendar.google.com`',
                inline: true
            },
        ]
    }]},
];

export const calendarCommandChConfigs = [
    {
        channelName: 'admin-commands',
        file: adminCommandsEmbed,
        visibility: ['Bot Admin']
    },
    {
        channelName: 'staff-commands',
        file: helperCommandsEmbed,
        visibility: ['Bot Admin', 'Staff']
    },
    {
        channelName: 'student-commands',
        file: studentCommandsEmbed,
        visibility: ['Bot Admin', 'Staff', 'Student']
    }
];
