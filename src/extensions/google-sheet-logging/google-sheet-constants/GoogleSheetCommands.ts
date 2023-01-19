import { EmbedColor } from '../../../utils/embed-helper.js';
import { HelpMessage } from '../../../utils/type-aliases.js';

const setGoogleSheetHelp: HelpMessage = {
    nameValuePair: {
        name: 'set_google_sheet',
        value: 'set_google_sheet'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/set_google_sheet`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Changes which google sheet this sever uses.',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: "`sheet_id: string`\nThe id of the google sheet to change to. This google sheet need to be shared with this YABOB's email. See the [wiki](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Built-in-Extension-Commands#google-sheet-logging-extension-commands) on how to find this id.",
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/set_google_sheet somereallylongstringfromthesheeturl`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const statsHelperHelp: HelpMessage = {
    nameValuePair: {
        name: 'stats helper',
        value: 'stats helper' // TODO: Maybe use an enum or const object for this
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/stats helper`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Gets help session statistics for this **helper**',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: "time_frame: 'All Time' | 'Past Month' | 'Past Week', specifies the time frame of the statistics.",
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/stats helper "All Time"`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const statsServerHelp: HelpMessage = {
    nameValuePair: {
        name: 'stats server',
        value: 'stats server'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/stats server`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Gets help session statistics for this **server**',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: "time_frame: 'All Time' | 'Past Month' | 'Past Week', specifies the time frame of the statistics.",
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/stats server "All Time"`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const weeklyReportHelperHelp: HelpMessage = {
    nameValuePair: {
        name: 'weekly_report helper',
        value: 'weekly_report helper'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/weekly_report helper`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Gets a weekly summary of help sessions for this **helper**',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: "`num_weeks`: integer, specifies how many weeks of data to gather\n`user`: User, specifies which user's data to gather.",
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/weekly_report helper 4 staffName`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const weeklyReportServerHelp: HelpMessage = {
    nameValuePair: {
        name: 'weekly_report server',
        value: 'weekly_report server'
    },
    useInHelpChannel: true,
    useInHelpCommand: false,
    message: {
        embeds: [
            {
                color: EmbedColor.NoColor,
                title: 'Command: `/weekly_report server`',
                fields: [
                    {
                        name: 'Description',
                        value: 'Gets a weekly summary of help sessions for this **server**',
                        inline: false
                    },
                    {
                        name: 'Options',
                        value: '`num_weeks`: integer, specifies how many weeks of data to gather',
                        inline: true
                    },
                    {
                        name: 'Example Usage',
                        value: '`/weekly_report server 4`',
                        inline: true
                    }
                ]
            }
        ]
    }
};

const googleSheetAdminHelpMessages = [setGoogleSheetHelp];

const googleSheetStaffHelpMessages = [
    statsHelperHelp,
    statsServerHelp,
    weeklyReportHelperHelp,
    weeklyReportServerHelp
];

export { googleSheetAdminHelpMessages, googleSheetStaffHelpMessages };
