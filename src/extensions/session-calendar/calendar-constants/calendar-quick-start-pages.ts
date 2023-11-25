import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { AttendingServer } from '../../../attending-server/base-attending-server.js';
import { QuickStartPageFunctions, YabobEmbed } from '../../../utils/type-aliases.js';
import { buildComponent } from '../../../utils/component-id-factory.js';
import {
    generatePageNumber,
    NavigationRow
} from '../../../attending-server/quick-start-pages.js';
import { CalendarButtonNames } from './calendar-interaction-names.js';
import { EmbedColor } from '../../../utils/embed-helper.js';

function CalendarIdQuickStart(server: AttendingServer, updateMessage = ''): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle('Quick Start - Google Calendar')
        .setColor(EmbedColor.Aqua)
        .setFields(
            {
                name: 'Description',
                value: 'Connect YABOB to a public google calendar to show upcoming office hour sessions in queue channels.'
            },
            {
                name: 'Documentation',
                value: `[Learn more about calendar integration here.](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Configure-YABOB-Settings-For-Your-Server#calendar-settings)`
            }
        )
        .setFooter({
            text: `${generatePageNumber(CalendarIdQuickStart)}${
                updateMessage ? ` • ✅ ${updateMessage}` : ''
            }`
        });
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            CalendarButtonNames.ShowCalendarModalFromQuickStart,
            server.guild.id
        ])
            .setEmoji('🗓')
            .setLabel('Add a calendar ID')
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [buttons, NavigationRow(server.guildId)]
    };
}

const quickStartPages = [
    CalendarIdQuickStart
] as const satisfies readonly QuickStartPageFunctions[];

export { quickStartPages, CalendarIdQuickStart };
