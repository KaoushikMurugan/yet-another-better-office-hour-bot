import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SelectMenuBuilder,
    SelectMenuComponentOptionData,
    Snowflake
} from 'discord.js';
import { EmbedColor } from '../utils/embed-helper.js';
import {
    SettingsMenuCallback,
    SpecialRoleValues,
    YabobEmbed
} from '../utils/type-aliases.js';
import { buttonFactory, selectMenuFactory } from '../utils/component-id-factory.js';
import { AttendingServerV2 } from './base-attending-server.js';
import { isTextChannel, longestCommonSubsequence } from '../utils/util-functions.js';

const mainMenuRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    buttonFactory
        .buildComponent('other', 'return_to_main_menu', undefined, undefined)
        .setEmoji('🏠')
        .setLabel('Return to Main Menu')
        .setStyle(ButtonStyle.Primary)
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const EmptyEmbedField = {
    name: '\u200b',
    value: '\u200b'
} as const;

/** Use this string to force a trailing new line in an embed field */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const trailingNewLine = '\n\u200b' as const;
/** Use this string to force a leading new line in an embed field */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const leadingNewLine = '\u200b\n' as const;

/**
 * Options for the main menu of server settings
 */
const serverSettingsMainMenuOptions: {
    optionObj: SelectMenuComponentOptionData;
    subMenu: SettingsMenuCallback;
}[] = [
    {
        optionObj: {
            emoji: '📝',
            label: 'Server Roles',
            description: 'Configure the server roles',
            value: 'server-roles'
        },
        subMenu: RolesConfigMenu
    },
    {
        optionObj: {
            emoji: '📨',
            label: 'After Session Message',
            description: 'Configure the message sent after a session',
            value: 'after-session-message'
        },
        subMenu: AfterSessionMessageConfigMenu
    },
    {
        optionObj: {
            emoji: '⏳',
            label: 'Queue Auto Clear',
            description: 'Configure the auto-clearing of queues',
            value: 'queue-auto-clear'
        },
        subMenu: QueueAutoClearConfigMenu
    },
    {
        optionObj: {
            emoji: '🪵',
            label: 'Logging Channel',
            description: 'Configure the logging channel',
            value: 'logging-channel'
        },
        subMenu: LoggingChannelConfigMenu
    },
    {
        optionObj: {
            emoji: '🎓',
            label: 'Auto Give Student Role',
            description: 'Configure the auto-giving of the student role',
            value: 'auto-give-student-role'
        },
        subMenu: AutoGiveStudentRoleConfigMenu
    }
];

/**
 * Composes the server settings main menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function SettingsMainMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(`🛠 Server Settings for ${server.guild.name} 🛠`)
        .setColor(EmbedColor.Aqua)
        .setDescription(
            'This is the main menu for server settings. Select an option from the drop-down menu below to enter the individual configuration menus.'
        )
        .addFields({
            name: 'User Manual',
            value: 'Check out our [documentation](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Configure-YABOB-Settings-For-Your-Server) for detailed description of each setting. '
        })
        .setFooter({
            text:
                'Your settings are always automatically saved as soon as you make a change. ' +
                'You can dismiss this message at any time to finish configuring YABOB.'
        });
    const selectMenu = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
        selectMenuFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                'server_settings',
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setPlaceholder('Select an option')
            .addOptions(serverSettingsMainMenuOptions.map(option => option.optionObj))
    );
    return { embeds: [embed.data], components: [selectMenu] };
}

/**
 * Composes the server roles configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @param forServerInit
 * @returns
 */
function RolesConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean,
    forServerInit = false
): YabobEmbed {
    const generatePing = (id: Snowflake | SpecialRoleValues) => {
        return id === SpecialRoleValues.NotSet
            ? 'Not Set'
            : id === SpecialRoleValues.Deleted
            ? '@deleted-role'
            : isDm // role pings shows up as '@deleted-role' in dm even if it exists
            ? server.guild.roles.cache.get(id)?.name ?? '@deleted-role'
            : `<@&${id}>`;
    };
    const embed = new EmbedBuilder()
        .setTitle(`📝 Server Roles Configuration for ${server.guild.name} 📝`)
        .setColor(EmbedColor.Aqua)
        .addFields({
            name: 'Description',
            value:
                'Configures which roles should YABOB interpret as Bot Admin, Staff, and Student. ' +
                'Learn more about YABOB roles [here](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Configure-YABOB-Settings-For-Your-Server).'
        })
        .addFields({
            name: 'Options',
            value: `🔵 Use Existing Roles - Use existing roles named the same as the missing roles. If not found, create new roles.
            🟠 Create New Roles - Create brand new roles for the missing roles`
        })
        .addFields({
            name: '🤖 Bot Admin Role',
            value: forServerInit
                ? `*Role that can manage the bot and its settings*\n`
                : generatePing(server.botAdminRoleID),
            inline: true
        })
        .addFields({
            name: '📚 Staff Role',
            value: forServerInit
                ? `*Role that allows users to host office hours*\n`
                : generatePing(server.helperRoleID),
            inline: true
        })
        .addFields({
            name: '🎓 Student Role',
            value: forServerInit
                ? `*Role that allows users to join office hour queues*\n`
                : generatePing(server.studentRoleID),
            inline: true
        });
    if (forServerInit) {
        embed.setDescription(
            `**Thanks for choosing YABOB for helping you with office hours!
            To start using YABOB, it requires the following roles: **\n`
        );
    }
    if (!forServerInit && isDm) {
        embed.setFooter({
            text: `Discord does not render server roles in DM channels. Please go to ${server.guild.name} to see the newly created roles.`
        });
    }
    const buttons = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            buttonFactory
                .buildComponent(
                    isDm ? 'dm' : 'other',
                    `server_role_config_1`,
                    isDm ? server.guild.id : undefined,
                    isDm ? channelId : undefined
                )
                .setLabel('🔵 Use Existing Roles')
                .setStyle(ButtonStyle.Secondary),
            buttonFactory
                .buildComponent(
                    isDm ? 'dm' : 'other',
                    `server_role_config_1a`,
                    isDm ? server.guild.id : undefined,
                    isDm ? channelId : undefined
                )
                .setLabel('🔵 Use Existing Roles (@everyone is student)')
                .setStyle(ButtonStyle.Secondary)
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            buttonFactory
                .buildComponent(
                    isDm ? 'dm' : 'other',
                    `server_role_config_2`,
                    isDm ? server.guild.id : undefined,
                    isDm ? channelId : undefined
                )
                .setLabel('🟠 Create New Roles')
                .setStyle(ButtonStyle.Secondary),
            buttonFactory
                .buildComponent(
                    isDm ? 'dm' : 'other',
                    `server_role_config_2a`,
                    isDm ? server.guild.id : undefined,
                    isDm ? channelId : undefined
                )
                .setLabel('🟠 Create New Roles (@everyone is student)')
                .setStyle(ButtonStyle.Secondary)
        )
    ];
    return {
        embeds: [embed.data],
        components: isDm ? buttons : [...buttons, mainMenuRow]
    };
}

/**
 * Composes the after session message configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function AfterSessionMessageConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(`📨 After Session Message Configuration for ${server.guild.name} 📨`)
        .addFields({
            name: 'Description',
            value: 'The after session message is sent to students after they finish their session with a helper. (i.e. upon leaving the voice channel)'
        })
        // addFields accepts RestOrArray<T>,
        // so they can be combined into a single addFields call, but prettier makes it ugly
        .addFields({
            name: 'Options',
            value: `⚙️ - Set the after session message
            🔒 - Disable the after session message. YABOB will no longer send the message to students after they finish their session.`
        })
        .addFields({
            name: '» Current After Session Message',
            value: `${
                server.afterSessionMessage === ''
                    ? '`Not Set`'
                    : `${server.afterSessionMessage
                          .trim()
                          .split('\n')
                          .map(line => `> ${line}`)
                          .join('\n')}` // show the existing message in a quote block
            }`
        });
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                'after_session_message_config_1',
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('⚙️')
            .setLabel('Edit Message')
            .setStyle(ButtonStyle.Secondary),
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                'after_session_message_config_2',
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed.data], components: [buttons, mainMenuRow] };
}

/**
 * Composes the queue auto clear configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function QueueAutoClearConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(`⏳ Queue Auto Clear Configuration for ${server.guild.name} ⏳`)
        .setColor(EmbedColor.Aqua)
        .addFields({
            name: 'Description',
            value: `If enabled, YABOB will automatically clear all the closed queues after the set amount of time.`
        })
        .addFields({
            name: 'Options',
            value: `⚙️ - Set the queue auto clear time
            🔒 - Disable the queue auto clear feature.`
        })
        .addFields({
            name: '» Current Auto Clear Timeout',
            value:
                server.queueAutoClearTimeout === undefined ||
                server.queueAutoClearTimeout === 'AUTO_CLEAR_DISABLED'
                    ? `**Disabled** - Queues will not be cleared automatically.`
                    : `Queues will automatically be cleared in **${`${server.queueAutoClearTimeout.hours}h ${server.queueAutoClearTimeout.minutes}min`}** after it closes.`
        });
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                `queue_auto_clear_config_1`,
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('⚙️')
            .setLabel('Set Auto Clear Time')
            .setStyle(ButtonStyle.Secondary),
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                `queue_auto_clear_config_2`,
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed.data], components: [buttons, mainMenuRow] };
}

/**
 * Composes the logging channel configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function LoggingChannelConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    // TODO: Implement a direct way to change the logging channel
    const setLoggingChannelCommandId = server.guild.commands.cache.find(
        command => command.name === 'set_logging_channel'
    )?.id;
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                'logging_channel_config_2',
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    const embed = new EmbedBuilder()
        .setTitle(`🪵 Logging Configuration for ${server.guild.name} 🪵`)
        .setColor(EmbedColor.Aqua)
        .addFields({
            name: 'Description',
            value: 'If enabled, YABOB will send log embeds to the given text channel after receiving interactions and encountering errors.'
        })
        .addFields({
            name: 'Note: Select menu length limit',
            value: `Discord only allows a maximum of 25 options in this select menu. If your desired logging channel is not listed, you can use the ${
                setLoggingChannelCommandId
                    ? `</set_logging_channel:${setLoggingChannelCommandId}>`
                    : '`/set_logging_channel`'
            } command to select any text channel on this server.`
        })
        .addFields({
            name: 'Options',
            value: `Use the select menu below to choose the target text channel.
            🔒 - Disable the logging feature`
        })
        .addFields({
            name: '» Current Logging Channel',
            value:
                server.loggingChannel === undefined
                    ? 'Logging is not enabled.'
                    : server.loggingChannel.toString()
        });
    // Filter out the channels that are more likely to be logging channels
    // based on how many characters in the channel name matches with 'logs'
    const mostLikelyLoggingChannels = server.guild.channels.cache
        .filter(
            channel =>
                isTextChannel(channel) &&
                channel.name !== 'queue' &&
                channel.name !== 'chat'
        ) // don't consider the queue channels
        .sort(
            // sort by LCS, higher LCS with 'logs' are closer to the start of the array
            // TODO: change the 'logs' parameter to another string if necessary
            (channel1, channel2) =>
                longestCommonSubsequence(channel2.name.toLowerCase(), 'logs') -
                longestCommonSubsequence(channel1.name.toLowerCase(), 'logs')
        );
    const channelsSelectMenu = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
        // TODO: change customid
        new SelectMenuBuilder()
            .setCustomId('PlaceHolder')
            .setPlaceholder('Select a Text Channel')
            .addOptions(
                // Cannot have more than 25 options
                mostLikelyLoggingChannels.first(25).map(channel => ({
                    label: channel.name,
                    description: channel.name,
                    value: channel.id
                }))
            )
    );
    return {
        embeds: [embed.data],
        components: [channelsSelectMenu, buttons, mainMenuRow]
    };
}

function AutoGiveStudentRoleConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(`🎓 Auto Give Student Role Configuration for ${server.guild.name} 🎓`)
        .setColor(EmbedColor.Aqua)
        .addFields({
            name: 'Description',
            value: `Whether to automatically give new members the <@&${server.studentRoleID}> role if configured.`
        })
        .addFields({
            name: 'Options',
            value: `🔓 - Enable the auto give student role feature
            🔒 - Disable the auto give student role feature`
        })
        .addFields({
            name: '» Current Configuration',
            value: server.autoGiveStudentRole
                ? `**Enabled** - New members will automatically get <@&${server.studentRoleID}>.`
                : `**Disabled** - New members need to be manually assigned <@&${server.studentRoleID}>.`
        });
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                'auto_give_student_role_config_1',
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('🔓')
            .setLabel('Enable')
            .setStyle(ButtonStyle.Secondary),
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                'auto_give_student_role_config_2',
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed.data], components: [buttons, mainMenuRow] };
}

export {
    SettingsMainMenu,
    serverSettingsMainMenuOptions,
    RolesConfigMenu,
    AfterSessionMessageConfigMenu,
    QueueAutoClearConfigMenu,
    LoggingChannelConfigMenu,
    AutoGiveStudentRoleConfigMenu,
    mainMenuRow
};
