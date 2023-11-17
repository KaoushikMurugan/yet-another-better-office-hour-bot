import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { EmbedColor } from '../../../utils/embed-helper.js';
import { SettingsMenuOption, YabobEmbed } from '../../../utils/type-aliases.js';
import { buildComponent } from '../../../utils/component-id-factory.js';
import { CalendarExtensionState } from '../calendar-states.js';
import { SettingsSwitcher } from '../../../attending-server/server-settings-menus.js';
import { restorePublicEmbedURL } from '../shared-calendar-functions.js';
import { FrozenServer } from '../../extension-utils.js';
import { CalendarButtonNames } from './calendar-interaction-names.js';

/**
 * Options for the server settings main menu
 * @see {@link serverSettingsMainMenuOptions}
 */
const calendarSettingsMainMenuOptions: SettingsMenuOption[] = [
    {
        selectMenuOptionData: {
            emoji: '🗓',
            label: 'Calendar Settings',
            description: 'Configure the calendar settings',
            value: 'calendar-settings'
        },
        useInSettingsCommand: true,
        menu: CalendarSettingsConfigMenu
    }
];

/** Compose the calendar settings settings menu */
function CalendarSettingsConfigMenu(
    server: FrozenServer,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const state = CalendarExtensionState.allStates.get(server.guild.id);
    if (!state) {
        throw new Error('Calendar state for this server was not found');
    }
    const embed = new EmbedBuilder()
        .setTitle(`🗓 Calendar Configuration for ${server.guild.name} 🗓`)
        .setColor(EmbedColor.Aqua)
        .setFields(
            {
                name: 'Description',
                value: 'This setting controls which calendar this server will refer to for office hours events.'
            },
            {
                name: 'Documentation',
                value: `[Learn more about calendar settings here.](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Configure-YABOB-Settings-For-Your-Server#calendar-settings)`
            },
            {
                name: 'Current Office Hours Calendar',
                value: `[Google Calendar](${restorePublicEmbedURL(state.calendarId)})`
            },
            {
                name: 'Current Office Hours Calendar Embed URL',
                value: `[Embed Override](${state.publicCalendarEmbedUrl})`
            }
        )
        .setFooter({
            text: updateMessage
                ? `✅ ${updateMessage}`
                : 'Note: If you change the calendar, the embed url will be reset to the default embed url for the new calendar.'
        });
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            CalendarButtonNames.ShowCalendarSettingsModal,
            server.guild.id
        ])
            .setEmoji('🗓')
            .setLabel('Change Calendar Settings')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            CalendarButtonNames.ResetCalendarSettings,
            server.guild.id
        ])
            .setEmoji('🔗')
            .setLabel('Reset Calendar Settings')
            .setStyle(ButtonStyle.Secondary)
    );
    return {
        embeds: [embed],
        components: [buttons, SettingsSwitcher(CalendarSettingsConfigMenu)]
    };
}

export { CalendarSettingsConfigMenu, calendarSettingsMainMenuOptions };
