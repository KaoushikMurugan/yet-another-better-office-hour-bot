import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../../../utils/embed-helper.js';
import { YabobEmbed } from '../../../utils/type-aliases.js';
import {
    generateComponentId,
    yabobButtonIdToString
} from '../../../utils/util-functions.js';
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
    function composeCSCMButtonId(optionNumber: string): string {
        const newYabobButton = generateComponentId(
            isDm ? 'dm' : 'other',
            `calendar_settings_config_menui_${optionNumber}`,
            isDm ? server.guild.id : undefined,
            isDm ? channelId : undefined
        );
        return yabobButtonIdToString(newYabobButton);
    }
    const state = calendarStates.get(server.guild.id);
    if (!state) {
        throw new Error('Calendar state for this server was not found');
    }
    const embed = SimpleEmbed(
        `🗓 Calendar Configuration for ${server.guild.name} 🗓`,
        EmbedColor.Aqua,
        `**\nOffice Hours Calendar:** ${restorePublicEmbedURL(state.calendarId)}\n\n` +
            `*This is the calendar that the server refers to for office hours events*` +
            `\n\n` +
            `**Office Hours Calendar Embed URL:** ${state.publicCalendarEmbedUrl}\n\n` +
            `*This is the url that will be linked in the upcoming hours embed.*\n\n` +
            `***Select an option from below to change the configuration:***\n\n` +
            `**Note:** If you change the calendar, the embed url will be reset to the default embed url for the new calendar.\n\n` +
            `**🗓** - Change the Calendar Config\n` +
            `**🔗** - Set the Calendar and Embed URL back to the default\n`
    );
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(composeCSCMButtonId('1'))
            .setEmoji('🗓')
            .setLabel('Change Calendar Settings')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(composeCSCMButtonId('2'))
            .setEmoji('🔗')
            .setLabel('Set to Default Calendar Settings')
            .setStyle(ButtonStyle.Secondary)
    );
    return {
        embeds: embed.embeds,
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
