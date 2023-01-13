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

const googleSheetAdminHelpMessages = [setGoogleSheetHelp];

export { googleSheetAdminHelpMessages };
