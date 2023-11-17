import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Snowflake,
    StringSelectMenuBuilder
} from 'discord.js';
import {
    QuickStartPageFunctions,
    SpecialRoleValues,
    YabobEmbed
} from '../utils/type-aliases.js';
import { buildComponent } from '../utils/component-id-factory.js';
import {
    ButtonNames,
    CommandNames,
    SelectMenuNames
} from '../interaction-handling/interaction-constants/interaction-names.js';
import { EmbedColor } from '../utils/embed-helper.js';
import { AttendingServerV2 } from './base-attending-server.js';
import {
    documentationLinks,
    supportServerInviteLink,
    wikiBaseUrl
} from '../utils/documentation-helper.js';
import { isTextChannel, longestCommonSubsequence } from '../utils/util-functions.js';

const quickStartPages = [
    QuickStartFirstPage,
    QuickStartSetRoles,
    QuickStartCreateAQueue,
    QuickStartAutoGiveStudentRole,
    QuickStartLoggingChannel,
    QuickStartLastPage
] as const satisfies readonly QuickStartPageFunctions[];

function generatePageNumber(targetPage: QuickStartPageFunctions): string {
    return `Page ${quickStartPages.findIndex(page => page === targetPage) + 1}/${
        quickStartPages.length
    }`;
}

function QuickStartFirstPage(server: AttendingServerV2): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle('Quick Start')
        .setColor(EmbedColor.Aqua)
        .setDescription(
            `**Welcome to YABOB!** This is a quick start guide to get you started with the bot. If you have any questions, \
            check out [the guide on github](${wikiBaseUrl}) or [the support discord server](${supportServerInviteLink}).` +
                '\n\nUse the **Next** button to go to the next page, and the **Back** button to go to the previous page. ' +
                'Use the **Skip** button to skip a page. '
        )
        .setFooter({
            text: generatePageNumber(QuickStartFirstPage)
        });

    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(false, server.guild.id),
        quickStartNextButton(true, server.guild.id)
    );

    return {
        embeds: [embed],
        components: [quickStartButtons]
    };
}

function QuickStartSetRoles(server: AttendingServerV2, updateMessage = ''): YabobEmbed {
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
        .setTitle(`Quick Start: Set Roles`)
        .setColor(EmbedColor.Aqua)
        .setFooter({
            text:
                `${generatePageNumber(QuickStartSetRoles)}` +
                (updateMessage.length > 0 ? ` ● ✅ ${updateMessage}` : '')
        })
        .addFields(
            {
                name: 'Description',
                value:
                    'YABOB requires three roles to function properly: **Bot Admin**, **Staff**, and **Student**. These roles are used to control access to the bot and its commands. ' +
                    'For fresh servers, we recommend using [Create New Roles].' +
                    `\n\nIf you'd like more *granular* control over roles, use the **</set_roles:${setRolesCommandId}> command.**`
            },
            {
                name: 'Documentation',
                value: `[Learn more about YABOB roles here.](${documentationLinks.serverRoles})`
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
    const buttons = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig1QS,
                server.guild.id
            ])
                .setEmoji('🔵')
                .setLabel('Use Existing Roles')
                .setStyle(ButtonStyle.Secondary),
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig1aQS,
                server.guild.id
            ])
                .setEmoji('🔵')
                .setLabel('Use Existing Roles (@everyone is student)')
                .setStyle(ButtonStyle.Secondary)
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig2QS,
                server.guild.id
            ])
                .setEmoji('🟠')
                .setLabel('Create New Roles')
                .setStyle(ButtonStyle.Secondary),
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig2aQS,
                server.guild.id
            ])
                .setEmoji('🟠')
                .setLabel('Create New Roles (@everyone is student)')
                .setStyle(ButtonStyle.Secondary)
        )
    ];
    // always make Next available, because we can't detect if /set_roles is used
    // if the user manually sets up all the roles with set_roles
    // we don't have a way to update this menu
    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(true, server.guild.id),
        quickStartNextButton(true, server.guild.id)
    );
    return {
        embeds: [embed.data],
        components: [...buttons, quickStartButtons]
    };
}

function QuickStartCreateAQueue(server: AttendingServerV2): YabobEmbed {
    // get the queue add command id
    const queueAddCommandId = server.guild.commands.cache.find(
        command =>
            command.name === CommandNames.queue && command.options[0]?.name === 'add'
    )?.id;

    const embed = new EmbedBuilder()
        .setTitle('Quick Start - Create a Queue')
        .setColor(EmbedColor.Aqua)
        .setDescription(
            '**Now that you have set up your server roles, try creating a queue!**' +
                `\n\nUse the **</queue add:${queueAddCommandId}>** command to create a queue. Enter the name of the queue, e.g. \`Office Hours\`` +
                `\n\nAfter entering the command you should be able to see a new category created on the server with the name you entered, under it will be a \`#chat\` channel and \`#queue\` channel`
        )
        .setFooter({
            text: generatePageNumber(QuickStartCreateAQueue)
        });

    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(true, server.guild.id),
        quickStartNextButton(true, server.guild.id)
    );

    return {
        embeds: [embed],
        components: [quickStartButtons]
    };
}

function QuickStartAutoGiveStudentRole(
    server: AttendingServerV2,

    updateMessage = ''
): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle('Quick Start - Auto Give Student Role')
        .setColor(EmbedColor.Aqua)
        .addFields(
            {
                name: 'Description',
                value: `YABOB can automatically give the student (<@&${server.studentRoleID}>) role to each new user that joins this server.`
            },
            {
                name: 'Note: Integrate with other bots',
                value: "If you wish to use another bot to control the assignment of roles, that's fine! It is only important that YABOB knows which roles are the student, helper and bot admin roles."
            },
            {
                name: 'Documentation',
                value: `[Learn more about auto give student role here.](${documentationLinks.autoGiveStudentRole})`
            },
            {
                name: 'Current Configuration',
                value: server.autoGiveStudentRole
                    ? `**Enabled** - New members will automatically assigned <@&${server.studentRoleID}>.`
                    : `**Disabled** - New members need to be manually assigned <@&${server.studentRoleID}>.`
            }
        )
        .setFooter({
            text:
                `${generatePageNumber(QuickStartAutoGiveStudentRole)}` +
                (updateMessage.length > 0 ? ` ● ✅ ${updateMessage}` : '')
        });

    const settingsButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.AutoGiveStudentRoleConfig1QS,
            server.guild.id
        ])
            .setEmoji('🔓')
            .setLabel('Enable')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.AutoGiveStudentRoleConfig2QS,
            server.guild.id
        ])
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );

    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(true, server.guild.id),
        quickStartNextButton(true, server.guild.id)
    );

    return {
        embeds: [embed],
        components: [settingsButtons, quickStartButtons]
    };
}

function QuickStartLoggingChannel(
    server: AttendingServerV2,

    updateMessage = ''
): YabobEmbed {
    const setLoggingChannelCommandId = server.guild.commands.cache.find(
        command => command.name === 'set_logging_channel'
    )?.id;
    const embed = new EmbedBuilder()
        .setTitle('Quick Start - Logging Channel')
        .setColor(EmbedColor.Aqua)
        .addFields(
            {
                name: 'Description',
                value:
                    'YABOB can log any interactions with it, such as commands, buttons and more. This is useful if you run into any unexpected errors involving YABOB.' +
                    '\n\nYou can enable logging by selecting a text channel from the dropdown menu below. If you wish to disable logging, select the **Disable** option.'
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
        )
        .setFooter({
            text:
                `${generatePageNumber(QuickStartLoggingChannel)}` +
                (updateMessage.length > 0 ? ` • ✅ ${updateMessage}` : '')
        });
    const possibleLoggingChannels = server.guild.channels.cache
        .filter(
            channel =>
                isTextChannel(channel) &&
                channel.name !== 'queue' &&
                channel.name !== 'chat'
        )
        .sort(
            (channel1, channel2) =>
                longestCommonSubsequence(channel2.name.toLowerCase(), 'logs') -
                longestCommonSubsequence(channel1.name.toLowerCase(), 'logs')
        );

    const channelsSelectMenu =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            buildComponent(new StringSelectMenuBuilder(), [
                'other',
                SelectMenuNames.SelectLoggingChannelQS,
                server.guild.id
            ])
                .setPlaceholder('Select a Text Channel')
                .addOptions(
                    // Cannot have more than 25 options
                    possibleLoggingChannels.first(25).map(channel => ({
                        label: channel.name,
                        description: channel.name,
                        value: channel.id
                    }))
                )
        );

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.DisableLoggingChannelQS,
            server.guild.id
        ])
            .setEmoji('🔒')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
    );

    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(true, server.guild.id),
        quickStartNextButton(true, server.guild.id)
    );

    return {
        embeds: [embed],
        components: [channelsSelectMenu, buttons, quickStartButtons]
    };
}

function QuickStartLastPage(server: AttendingServerV2): YabobEmbed {
    const settingsCommandId = server.guild.commands.cache.find(
        command => command.name === CommandNames.settings
    )?.id;
    const embed = new EmbedBuilder()
        .setTitle('Quick Start - Finished!')
        .setDescription(
            `Congratulations! You have completed the quick start guide. If you have any questions, \
            check out [the guide on github](${wikiBaseUrl}) or join [the support discord server](${supportServerInviteLink}).` +
                `\n\nThere are many other functionalities of the bot that you can explore via the ${
                    settingsCommandId ? `</settings:${settingsCommandId}>` : '`/settings`'
                } menu.`
        )
        .setFooter({
            text: generatePageNumber(QuickStartLastPage)
        });
    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(true, server.guild.id),
        quickStartNextButton(false, server.guild.id)
    );
    return {
        embeds: [embed],
        components: [quickStartButtons]
    };
}

function quickStartBackButton(enable: boolean, serverId: Snowflake): ButtonBuilder {
    return buildComponent(new ButtonBuilder(), [
        'other',
        ButtonNames.QuickStartBack,
        serverId
    ])
        .setEmoji('⬅️')
        .setLabel('Back')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!enable);
}

function quickStartNextButton(enable: boolean, serverId: Snowflake): ButtonBuilder {
    return buildComponent(new ButtonBuilder(), [
        'other',
        ButtonNames.QuickStartNext,
        serverId
    ])
        .setEmoji('➡️')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!enable);
}

export {
    quickStartPages,
    QuickStartFirstPage,
    QuickStartSetRoles,
    QuickStartAutoGiveStudentRole,
    QuickStartLoggingChannel,
    QuickStartCreateAQueue,
    QuickStartLastPage
};
