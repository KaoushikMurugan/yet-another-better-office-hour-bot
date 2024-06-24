import {
    APIEmbedField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';
import { SettingsSwitcher } from '../../../attending-server/server-settings-menus.js';
import { buildComponent } from '../../../utils/component-id-factory.js';
import { EmbedColor } from '../../../utils/embed-helper.js';
import { SettingsMenuOption, YabobEmbed } from '../../../utils/type-aliases.js';
import { FrozenServer } from '../../extension-utils.js';
import { ActivityTrackingButtonNames } from './interaction-names.js';

/**
 * Options for the server settings main menu
 * @see {@link serverSettingsMainMenuOptions}
 */
const activityTrackingSettingsMainMenuOptions: SettingsMenuOption[] = [
    {
        selectMenuOptionData: {
            emoji: '📊',
            label: 'Activity Tracking Settings',
            description: 'Configure the Activity Tracking settings',
            value: 'activity-tracking-settings'
        },
        useInSettingsCommand: true,
        menu: ActivityTrackingSettingsConfigMenu
    }
];

/** Compose the Google Sheet Logging settings settings menu */
function ActivityTrackingSettingsConfigMenu(
    server: FrozenServer,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {

    const enabledField: APIEmbedField = {
        name: 'Activity Tracking Status',
        value: ''
    };

    if (server.trackingEnabled) {
        enabledField.value = `Tracking is enabled. Check [the CS Tutoring at UCD website](https://sites.google.com/view/cs-tutoring-ucd/) for attendance logs`;
    } else {
        enabledField.value =
            'Tracking disabled. Enable tracking to track helper hours.';
    }

    const embed = new EmbedBuilder()
        .setTitle(`📊 Attendance Tracking Configuration for ${server.guild.name} 📊`)
        .setColor(EmbedColor.Aqua)
        .setFields(
            {
                name: 'Description',
                value: `This setting controls which google sheet this server will be used for logging.\n`
            },
            {
                name: 'Documentation',
                value: `[Learn more about Google Sheet Logging settings here.](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Configure-YABOB-Settings-For-Your-Server#google-sheet-settings)`
            },
            enabledField
        );

    if (updateMessage.length > 0) {
        embed.setFooter({ text: `✅ ${updateMessage}` });
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ActivityTrackingButtonNames.UpdateTrackingStatus,
            server.guild.id
        ])
            .setEmoji(`${!server.trackingEnabled ? '✔️' : '✖️'}`)
            .setLabel(
                `${!server.trackingEnabled ? 'Enable' : 'Disable'} Activity Tracking`
            )
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [buttons, SettingsSwitcher(ActivityTrackingSettingsConfigMenu)]
    };
}

export { ActivityTrackingSettingsConfigMenu, activityTrackingSettingsMainMenuOptions };