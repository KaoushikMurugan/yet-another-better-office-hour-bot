import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SelectMenuComponentOptionData
} from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../../utils/embed-helper.js';
import { SettingsMenuCallback, YabobEmbed } from '../../utils/type-aliases.js';
import {
    generateYabobButtonId,
    yabobButtonToString
} from '../../utils/util-functions.js';
import { AttendingServerV2 } from '../../attending-server/base-attending-server.js';
import { calendarStates } from './calendar-states.js';
import {
    composeReturnToMainMenuButton,
    serverSettingsMainMenuOptions
} from '../../attending-server/server-config-messages.js';
import { restorePublicEmbedURL } from './shared-calendar-functions.js';

const calendarSettingsMainMenuOptions: {
    optionObj: SelectMenuComponentOptionData;
    subMenu: SettingsMenuCallback;
}[] = [
    {
        optionObj: {
            emoji: '🗓',
            label: 'Calendar Settings',
            description: 'Configure the calendar settings',
            value: 'calendar-settings'
        },
        subMenu: calendarSettingsConfigMenu
    }
];

function calendarSettingsConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const state = calendarStates.get(server.guild.id);
    if (!state) {
        throw new Error('Calendar state for this server was not found');
    }

    const embed = SimpleEmbed(
        `🛠 Server Configuration for ${server.guild.name} 🛠`,
        EmbedColor.Aqua,
        'Calendar Settings' +
            '\n\n' +
            'The calendar configuration for this server is as follows:\n\n' +
            `**Office Hours Calendar:** ${restorePublicEmbedURL(state.calendarId)}\n` +
            `This is the calendar that the server refers to for office hours events` +
            `\n\n` +
            `**Office Hours Calendar Embed Url:** ${state.publicCalendarEmbedUrl}\n` +
            `This is the url that will be linked in the upcoming hours embed.\n\n` +
            `Select an option below to change the configuration.\n\n` +
            `**Note:** If you change the calendar, the embed url will be reset to the default embed url for the new calendar.\n\n` +
            `**1** - Change the Office Hours Calendar\n` +
            `**2** - Change the Office Hours Calendar Embed Url\n`
    );

    function composeCSCMButtonId(optionNumber: string): string {
        const newYabobButton = generateYabobButtonId(
            isDm ? 'dm' : 'other',
            `cscm${optionNumber}`,
            server.guild.id,
            channelId
        );
        return yabobButtonToString(newYabobButton);
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeCSCMButtonId('1'))
                .setLabel('Change Calendar')
                .setStyle(ButtonStyle.Secondary)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeCSCMButtonId('2'))
                .setLabel('Change Embed Url')
                .setStyle(ButtonStyle.Secondary)
        );

    const returnToMainMenuRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        composeReturnToMainMenuButton(server.guild.id, channelId)
    );

    return {
        embeds: embed.embeds,
        components: [buttons, returnToMainMenuRow]
    };
}

function appendSettingsMainMenuOptions(sent: boolean): void {
    if (!sent) {
        serverSettingsMainMenuOptions.push(...calendarSettingsMainMenuOptions);
    }
}

export { calendarSettingsConfigMenu, appendSettingsMainMenuOptions };
