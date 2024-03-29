import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    Snowflake
} from 'discord.js';
import { EmbedColor } from '../utils/embed-helper.js';
import {
    SettingsMenuConstructor,
    SettingsMenuOption,
    SpecialRoleValues,
    YabobEmbed
} from '../utils/type-aliases.js';
import { buildComponent } from '../utils/component-id-factory.js';
import { AttendingServer } from './base-attending-server.js';
import { isTextChannel, longestCommonSubsequence } from '../utils/util-functions.js';
import {
    ButtonNames,
    CommandNames,
    SelectMenuNames
} from '../interaction-handling/interaction-constants/interaction-names.js';
import { documentationLinks } from '../utils/documentation-helper.js';

/**
 * Composes the select menu that allows user to jump between different settings menus
 * @param currentMenu The builder function of the sub-Menu from which the settings menu is being called
 * - This menu is skipped. @example if the current menu is SeriousModeConfigMenu, then it won't be in the select menu dropdown
 * @returns the select menu object
 */
function SettingsSwitcher(
    currentMenu: SettingsMenuConstructor
): ActionRowBuilder<StringSelectMenuBuilder> {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        buildComponent(new StringSelectMenuBuilder(), [
            'other',
            SelectMenuNames.ServerSettings,
            '0' // unused
        ])
            .setPlaceholder('Traverse the server settings menu') // * Find a better placeholder
            .addOptions(
                serverSettingsMainMenuOptions
                    .filter(menuOption => menuOption.menu !== currentMenu)
                    .map(option => option.selectMenuOptionData)
            )
    );
}

/**
 * Options for the main menu of server settings
 */
const serverSettingsMainMenuOptions: SettingsMenuOption[] = [
    {
        selectMenuOptionData: {
            emoji: '🏠',
            label: 'Main Menu',
            description: 'Return to the main menu',
            value: 'main-menu'
        },
        useInSettingsCommand: false,
        menu: SettingsMainMenu
    },
    {
        selectMenuOptionData: {
            emoji: '📝',
            label: 'Server Roles',
            description: 'Configure the server roles',
            value: 'server-roles'
        },
        useInSettingsCommand: true,
        menu: RoleConfigMenu
    },
    {
        selectMenuOptionData: {
            emoji: '📨',
            label: 'After Session Message',
            description: 'Configure the message sent after a session',
            value: 'after-session-message'
        },
        useInSettingsCommand: true,
        menu: AfterSessionMessageConfigMenu
    },
    {
        selectMenuOptionData: {
            emoji: '⏳',
            label: 'Queue Auto Clear',
            description: 'Configure the auto-clearing of queues',
            value: 'queue-auto-clear'
        },
        useInSettingsCommand: true,
        menu: QueueAutoClearConfigMenu
    },
    {
        selectMenuOptionData: {
            emoji: '🪵',
            label: 'Logging Channel',
            description: 'Configure the logging channel',
            value: 'logging-channel'
        },
        useInSettingsCommand: true,
        menu: LoggingChannelConfigMenu
    },
    {
        selectMenuOptionData: {
            emoji: '🎓',
            label: 'Auto Give Student Role',
            description: 'Configure the auto-giving of the student role',
            value: 'auto-give-student-role'
        },
        useInSettingsCommand: true,
        menu: AutoGiveStudentRoleConfigMenu
    },
    {
        selectMenuOptionData: {
            emoji: '🙋',
            label: 'Help Topic Prompt',
            description: 'Configure the help topic prompt',
            value: 'help-topic-prompt'
        },
        useInSettingsCommand: true,
        menu: PromptHelpTopicConfigMenu
    },
    {
        selectMenuOptionData: {
            emoji: '🧐',
            label: 'Serious Mode',
            description: 'Configure the serious mode',
            value: 'serious-mode'
        },
        useInSettingsCommand: true,
        menu: SeriousModeConfigMenu
    }
];

/**
 * Composes the server settings main menu
 * @param server relevant server
 * @param channelId interaction channel id
 * @param isDm is it in dm?
 * @returns the setting menu embed object
 */
function SettingsMainMenu(server: AttendingServer): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(`🛠 Server Settings for ${server.guild.name} 🛠`)
        .setColor(EmbedColor.Aqua)
        .setDescription(
            'This is the main menu for server settings. Select an option from the drop-down menu below to enter the individual configuration menus.'
        )
        .addFields({
            name: 'User Manual',
            value: `Check out our [documentation](${documentationLinks.main}) for detailed description of each setting.`
        })
        .setFooter({
            text:
                'Your settings are always automatically saved as soon as you make a change. ' +
                'You can dismiss this message at any time to finish configuring YABOB.'
        });
    return {
        embeds: [embed.data],
        components: [SettingsSwitcher(SettingsMainMenu)]
    };
}

/**
 * Composes the server roles configuration menu
 * @param server related server
 * @param channelId id of the channel of the related interaction
 * @returns
 */
function RoleConfigMenu(
    server: AttendingServer,
    _isDm: boolean, // not used
    updateMessage = ''
): YabobEmbed {
    const generatePing = (id: Snowflake | SpecialRoleValues) => {
        return id === SpecialRoleValues.NotSet
            ? 'Not Set'
            : id === SpecialRoleValues.Deleted
              ? '@deleted-role'
              : `<@&${id}>`;
    };
    const setRolesCommandId = server.guild.commands.cache.find(
        command => command.name === CommandNames.set_roles
    )?.id;
    const embed = new EmbedBuilder()
        .setTitle(`📝 Server Roles Configuration for ${server.guild.name} 📝`)
        .setColor(EmbedColor.Aqua);
    // addFields accepts RestOrArray<T>, so they can be combined into a single addFields call
    embed.addFields(
        {
            name: 'Description',
            value: 'Configures which roles should YABOB interpret as Bot Admin, Staff, and Student.'
        },
        {
            name: 'Documentation',
            value: `[Learn more about YABOB roles here.](${documentationLinks.serverRoles}) For more granular control, use the </set_roles:${setRolesCommandId}> command.`
        },
        {
            name: 'Warning',
            value: 'If roles named Bot Admin, Staff, or Student already exist, duplicate roles will be created when using [Create new Roles].'
        },
        {
            name: '┈'.repeat(25),
            value: '**Current Role Configuration**'
        },
        {
            name: '🤖 Bot Admin Role',
            value: generatePing(server.botAdminRoleID),
            inline: true
        },
        {
            name: '📚 Staff Role',
            value: generatePing(server.staffRoleID),
            inline: true
        },
        {
            name: ' 🎓 Student Role',
            value: generatePing(server.studentRoleID),
            inline: true
        }
    );
    if (updateMessage.length > 0) {
        embed.setFooter({
            text: `✅ ${updateMessage}`
        });
    }
    const buttons = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig1SM,
                server.guild.id
            ])
                // this emoji string must be free of any other characters
                // otherwise it will throw a InteractionNotReplied Error, and discord js doesn't validate this
                .setEmoji('🔵')
                .setLabel('Use Existing Roles')
                .setStyle(ButtonStyle.Secondary),
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig1aSM,
                server.guild.id
            ])
                .setEmoji('🔵')
                .setLabel('Use Existing Roles (@everyone is student)')
                .setStyle(ButtonStyle.Secondary)
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig2SM,
                server.guild.id
            ])
                .setEmoji('🟠')
                .setLabel('Create New Roles')
                .setStyle(ButtonStyle.Secondary),
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig2aSM,
                server.guild.id
            ])
                .setEmoji('🟠')
                .setLabel('Create New Roles (@everyone is student)')
                .setStyle(ButtonStyle.Secondary)
        )
    ];
    return {
        embeds: [embed.data],
        components: [...buttons, SettingsSwitcher(RoleConfigMenu)]
    };
}

/**
 * Role config menu during server initialization
 * @param server relevant server
 * @param channelId dm channel id
 * @param completed whether the roles have been setup with this menu. Hide the buttons if true
 */
function RoleConfigMenuForServerInit(
    server: AttendingServer,
    completed = false
): YabobEmbed {
    const generatePing = (id: Snowflake) =>
        server.guild.roles.cache.get(id)?.name ?? 'This role has been deleted.';
    const embed = new EmbedBuilder()
        .setTitle(`📝 Server Roles Configuration for ${server.guild.name} 📝`)
        .setColor(EmbedColor.Aqua)
        .setDescription(
            '**Thanks for choosing YABOB for helping you with office hours! To start using YABOB, it requires the following roles: **\n'
        )
        .addFields(
            {
                name: 'Documentation',
                value:
                    `[Learn more about YABOB roles here.](${documentationLinks.serverRoles}) ` +
                    "If your server doesn't have any roles, use [Create New Roles] or [Create New Roles (@everyone is student)] for quick start."
            },
            {
                name: '┈'.repeat(25),
                value: '**Current Role Configuration**'
            },
            {
                name: '🤖 Bot Admin Role',
                value: completed
                    ? `\`${generatePing(server.botAdminRoleID)}\``
                    : `Role that can manage the bot and its settings`,
                inline: true
            },
            {
                name: '📚 Staff Role',
                value: completed
                    ? `\`${generatePing(server.staffRoleID)}\``
                    : `Role that allows users to host office hours`,
                inline: true
            },
            {
                name: ' 🎓 Student Role',
                value: completed
                    ? `\`${generatePing(server.studentRoleID)}\``
                    : `Role that allows users to join office hour queues`,
                inline: true
            }
        );
    if (completed) {
        embed.setFooter({
            text: `✅ Role configurations have been saved! You can now go back to ${server.guild.name} and start creating queues!`
        });
    }
    const buttons = completed
        ? [] // hide the buttons to avoid accidental clicks
        : [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                  buildComponent(new ButtonBuilder(), [
                      'dm',
                      ButtonNames.ServerRoleConfig1SM,
                      server.guild.id
                  ])
                      // this emoji string must be free of any other characters
                      // otherwise it will throw a InteractionNotReplied Error, and discord js doesn't validate this
                      .setEmoji('🔵')
                      .setLabel('Use Existing Roles')
                      .setStyle(ButtonStyle.Secondary),
                  buildComponent(new ButtonBuilder(), [
                      'dm',
                      ButtonNames.ServerRoleConfig1aSM,
                      server.guild.id
                  ])
                      .setEmoji('🔵')
                      .setLabel('Use Existing Roles (@everyone is student)')
                      .setStyle(ButtonStyle.Secondary)
              ),
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                  buildComponent(new ButtonBuilder(), [
                      'dm',
                      ButtonNames.ServerRoleConfig2SM,
                      server.guild.id
                  ])
                      .setEmoji('🟠')
                      .setLabel('Create New Roles')
                      .setStyle(ButtonStyle.Secondary),
                  buildComponent(new ButtonBuilder(), [
                      'dm',
                      ButtonNames.ServerRoleConfig2aSM,
                      server.guild.id
                  ])
                      .setEmoji('🟠')
                      .setLabel('Create New Roles (@everyone is student)')
                      .setStyle(ButtonStyle.Secondary)
              )
          ];

    return {
        embeds: [embed.data],
        components: buttons
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
    server: AttendingServer,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(`📨 After Session Message Configuration for ${server.guild.name} 📨`)
        .addFields(
            {
                name: 'Description',
                value: 'The after session message is sent to students after they finish their session with a helper. (i.e. upon leaving the voice channel)'
            },
            {
                name: 'Documentation',
                value: `[Learn more about after session message here.](${documentationLinks.afterSessionMessage})`
            },
            {
                name: 'Current After Session Message',
                value: `${
                    server.afterSessionMessage === ''
                        ? '**Disabled** - YABOB will not send any message to students after they leave the voice channel.'
                        : // each field only supports 1024 chars
                          `${server.afterSessionMessage.slice(0, 1000)}${
                              server.afterSessionMessage.length > 1000
                                  ? '...(Truncated)'
                                  : ''
                          }`
                }`
            }
        );
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.ShowAfterSessionMessageModal,
            server.guild.id
        ])
            .setEmoji('⚙️')
            .setLabel('Edit Message')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.DisableAfterSessionMessage,
            server.guild.id
        ])
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    if (updateMessage.length > 0) {
        embed.setFooter({ text: `✅ ${updateMessage}` });
    }
    return {
        embeds: [embed.data],
        components: [buttons, SettingsSwitcher(AfterSessionMessageConfigMenu)]
    };
}

/**
 * Composes the queue auto clear configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function QueueAutoClearConfigMenu(
    server: AttendingServer,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(`⏳ Queue Auto Clear Configuration for ${server.guild.name} ⏳`)
        .setColor(EmbedColor.Aqua)
        .addFields(
            {
                name: 'Description',
                value: 'If enabled, YABOB will automatically clear all the closed queues after the set amount of time.'
            },
            {
                name: 'Documentation',
                value: `[Learn more about queue auto clear here.](${documentationLinks.autoClear})`
            },
            {
                name: 'Current Auto Clear Timeout',
                value:
                    server.queueAutoClearTimeout === undefined ||
                    server.queueAutoClearTimeout === 'AUTO_CLEAR_DISABLED'
                        ? `**Disabled** - Queues will not be cleared automatically.`
                        : `**Enabled** - Queues will automatically be cleared in \
                        **${`${server.queueAutoClearTimeout.hours}h ${server.queueAutoClearTimeout.minutes}min`}** \
                        after it closes.`
            }
        );
    if (updateMessage.length > 0) {
        embed.setFooter({ text: `✅ ${updateMessage}` });
    }
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.ShowQueueAutoClearModal,
            server.guild.id
        ])
            .setEmoji('⚙️')
            .setLabel('Set Auto Clear Time')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.DisableQueueAutoClear,
            server.guild.id
        ])
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    return {
        embeds: [embed.data],
        components: [buttons, SettingsSwitcher(QueueAutoClearConfigMenu)]
    };
}

/**
 * Composes the logging channel configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function LoggingChannelConfigMenu(
    server: AttendingServer,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const setLoggingChannelCommandId = server.guild.commands.cache.find(
        command => command.name === 'set_logging_channel'
    )?.id;
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.DisableLoggingChannelSM,
            server.guild.id
        ])
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    const embed = new EmbedBuilder()
        .setTitle(`🪵 Logging Configuration for ${server.guild.name} 🪵`)
        .setColor(EmbedColor.Aqua)
        .addFields(
            {
                name: 'Description',
                value: 'If enabled, YABOB will send log embeds to the given text channel after receiving interactions and encountering errors.'
            },
            {
                name: 'Documentation',
                value: `[Learn more about YABOB logging channels here.](${documentationLinks.loggingChannel})`
            },
            {
                name: 'Note: Select menu length limit',
                value: `Discord only allows up to 25 options in this select menu. If your desired logging channel is not listed, you can use the ${
                    setLoggingChannelCommandId
                        ? `</set_logging_channel:${setLoggingChannelCommandId}>`
                        : '`/set_logging_channel`'
                } command to select any text channel on this server.`
            },
            {
                name: 'Current Logging Channel',
                value:
                    server.loggingChannel === undefined
                        ? '**Disabled** - YABOB will not send logs to this server.'
                        : server.loggingChannel.toString()
            }
        );
    if (updateMessage.length > 0) {
        embed.setFooter({ text: `✅ ${updateMessage}` });
    }
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
    const channelsSelectMenu =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            buildComponent(new StringSelectMenuBuilder(), [
                'other',
                SelectMenuNames.SelectLoggingChannelSM,
                server.guild.id
            ])
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
        components: [
            channelsSelectMenu,
            buttons,
            SettingsSwitcher(LoggingChannelConfigMenu)
        ]
    };
}

/**
 * Composes the auto give student role configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @param updateMessage
 * @returns
 */
function AutoGiveStudentRoleConfigMenu(
    server: AttendingServer,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(`🎓 Auto Give Student Role Configuration for ${server.guild.name} 🎓`)
        .setColor(EmbedColor.Aqua)
        .addFields(
            {
                name: 'Description',
                value: `Whether to automatically give new members the <@&${server.studentRoleID}> role if configured.`
            },
            {
                name: 'Documentation',
                value: `[Learn more about auto give student role here.](${documentationLinks.autoGiveStudentRole})`
            },
            {
                name: 'Current Configuration',
                value: server.autoGiveStudentRole
                    ? `**Enabled** - New members will automatically become <@&${server.studentRoleID}>.`
                    : `**Disabled** - New members need to be manually assigned <@&${server.studentRoleID}>.`
            }
        );
    if (updateMessage.length > 0) {
        embed.setFooter({ text: `✅ ${updateMessage}` });
    }
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.AutoGiveStudentRoleConfig1SM,
            server.guild.id
        ])
            .setEmoji('🔓')
            .setLabel('Enable')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.AutoGiveStudentRoleConfig2SM,
            server.guild.id
        ])
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    return {
        embeds: [embed.data],
        components: [buttons, SettingsSwitcher(AutoGiveStudentRoleConfigMenu)]
    };
}

/**
 * Composes the help topic prompt configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @param updateMessage
 * @returns
 */
function PromptHelpTopicConfigMenu(
    server: AttendingServer,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(`🙋 Help Topic Prompt Configuration for ${server.guild.name} 🙋`)
        .setColor(EmbedColor.Aqua)
        .addFields(
            {
                name: 'Description',
                value: `Whether to prompt students to select a help topic when they join the queue.`
            },
            {
                name: 'Documentation',
                value: `[Learn more about help topic prompts here.](${documentationLinks.promptHelpTopic})` //TODO: Add documentation link
            },
            {
                name: 'Current Configuration',
                value: server.promptHelpTopic
                    ? `**Enabled** - Students will be prompted to enter a help topic when they join the queue.`
                    : `**Disabled** - Students will not be prompted when they join the queue.`
            }
        );
    if (updateMessage.length > 0) {
        embed.setFooter({ text: `✅ ${updateMessage}` });
    }
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.PromptHelpTopicConfig1,
            server.guild.id
        ])
            .setEmoji('🔓')
            .setLabel('Enable')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.PromptHelpTopicConfig2,
            server.guild.id
        ])
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    return {
        embeds: [embed.data],
        components: [buttons, SettingsSwitcher(PromptHelpTopicConfigMenu)]
    };
}

/**
 * Composes the serious mode configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @param updateMessage
 * @returns
 */
function SeriousModeConfigMenu(
    server: AttendingServer,
    isDm: boolean,
    updateMessage = ''
): YabobEmbed {
    const noQueues = server.queues.length === 0;

    const embed = new EmbedBuilder()
        .setTitle(`🧐 Serious Mode Configuration for ${server.guild.name} 🧐`)
        .setColor(EmbedColor.Aqua)
        .addFields(
            {
                name: 'Description',
                value: `When serious mode is enabled, YABOB will not use emojis or emoticons for fun purposes (e.g. Sleeping emoticon when queue is closed). This will also disable any commands that\
                are not related to queue management`
            },
            {
                name: 'Documentation',
                value: `[Learn more about serious mode here.](${documentationLinks.seriousMode})`
            },
            {
                name: 'Current Configuration',
                value:
                    (server.isSerious
                        ? `**Enabled** - YABOB will not use emojis or emoticons for fun purposes.`
                        : `**Disabled** - YABOB can use emojis and emoticons for fun purposes.`) +
                    `\n\n**Note:** ${
                        noQueues
                            ? "There are no queues in the server so serious mode doesn't have any noticable effect"
                            : `Serious mode affects all queues in this server.`
                    }`
            }
        );
    if (updateMessage.length > 0) {
        embed.setFooter({ text: `✅ ${updateMessage}` });
    }
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.SeriousModeConfig1,
            server.guild.id
        ])
            .setEmoji('🔓')
            .setLabel('Enable')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), [
            isDm ? 'dm' : 'other',
            ButtonNames.SeriousModeConfig2,
            server.guild.id
        ])
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );
    return {
        embeds: [embed.data],
        components: [buttons, SettingsSwitcher(SeriousModeConfigMenu)]
    };
}

export {
    SettingsMainMenu,
    RoleConfigMenu,
    RoleConfigMenuForServerInit,
    AfterSessionMessageConfigMenu,
    QueueAutoClearConfigMenu,
    LoggingChannelConfigMenu,
    AutoGiveStudentRoleConfigMenu,
    PromptHelpTopicConfigMenu,
    SeriousModeConfigMenu,
    SettingsSwitcher,
    serverSettingsMainMenuOptions
};
