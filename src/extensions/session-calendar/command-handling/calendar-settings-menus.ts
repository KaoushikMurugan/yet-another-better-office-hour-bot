import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../../../utils/embed-helper.js';
import { YabobEmbed } from '../../../utils/type-aliases.js';
import { buttonFactory } from '../../../utils/component-id-factory.js';
import { calendarStates } from '../calendar-states.js';
import {
    mainMenuRow,
    serverSettingsMainMenuOptions
} from '../../../attending-server/server-settings-menus.js';
import { restorePublicEmbedURL } from '../shared-calendar-functions.js';
import { FrozenServer } from '../../extension-utils.js';

/**
 * Options for the server settings main menu
 * @see {@link serverSettingsMainMenuOptions}
 */
const calendarSettingsMainMenuOptions = [
    {
        optionObj: {
            emoji: '🗓',
            label: 'Calendar Settings',
            description: 'Configure the calendar settings',
            value: 'calendar-settings'
        },
        subMenu: calendarSettingsConfigMenu
    }
] as const;

/**
 * Compose the calendar settings settings menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function calendarSettingsConfigMenu(
    server: FrozenServer,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const state = calendarStates.get(server.guild.id);
    if (!state) {
        throw new Error('Calendar state for this server was not found');
    }
    const embed = new EmbedBuilder()
        .setTitle(`🗓 Calendar Configuration for ${server.guild.name} 🗓`)
        .setColor(EmbedColor.Aqua)
        .setDescription(
            'This is the calendar that this server refers to for office hours events'
        )
        .setFields(
            {
                name: 'Office Hours Calendar Id',
                value: `\`${state.calendarId}\``
            },
            {
                name: 'Office Hours Calendar Embed URL',
                value: state.publicCalendarEmbedUrl
            }
        )
        .setFooter({
            text: 'Note: If you change the calendar, the embed url will be reset to the default embed url for the new calendar.'
        });
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                'calendar_settings_config_menui_1',
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('🗓')
            .setLabel('Change Calendar Settings')
            .setStyle(ButtonStyle.Secondary),
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                'calendar_settings_config_menui_2',
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('🔗')
            .setLabel('Reset Calendar Settings')
            .setStyle(ButtonStyle.Secondary)
    );
    return {
        embeds: [embed],
        components: [buttons, mainMenuRow]
    };
}

/**
 * Adds the options in calendarSettingsMainMenuOptions to the server settings main menu options
 * @param sent
 */
function appendSettingsMainMenuOptions(sent: boolean): void {
    if (!sent) {
        serverSettingsMainMenuOptions.push(...calendarSettingsMainMenuOptions);
    }
}

export { calendarSettingsConfigMenu, appendSettingsMainMenuOptions };
