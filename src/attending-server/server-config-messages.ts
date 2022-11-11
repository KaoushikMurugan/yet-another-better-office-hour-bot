import {
    ActionRowBuilder,
    BaseMessageOptions,
    ButtonBuilder,
    ButtonStyle,
    SelectMenuBuilder,
    SelectMenuComponentOptionData
} from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../utils/embed-helper.js';
import { SettingsMenuCallback } from '../utils/type-aliases.js';
import {
    generateSelectMenuId,
    generateYabobButtonId,
    yabobButtonToString,
    yabobModalToString
} from '../utils/util-functions.js';
import { AttendingServerV2 } from './base-attending-server.js';

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
        subMenu: serverRolesConfigMenu
    },
    {
        optionObj: {
            emoji: '📨',
            label: 'After Session Message',
            description: 'Configure the message sent after a session',
            value: 'after-session-message'
        },
        subMenu: afterSessionMessageConfigMenu
    },
    {
        optionObj: {
            emoji: '⏳',
            label: 'Queue Auto Clear',
            description: 'Configure the auto-clearing of queues',
            value: 'queue-auto-clear'
        },
        subMenu: queueAutoClearConfigMenu
    },
    {
        optionObj: {
            emoji: '🪵',
            label: 'Logging Channel',
            description: 'Configure the logging channel',
            value: 'logging-channel'
        },
        subMenu: loggingChannelConfigMenu
    }
    // {
    //     optionObj: {
    //         emoji: '🗓',
    //         label: 'Calendar Settings',
    //         description: 'Configure the calendar settings',
    //         value: 'calendar-settings'
    //     },
    //     subMenu: calendarSettingsConfigMenu
    // }
];

function serverSettingsMainMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): BaseMessageOptions {
    const embed = SimpleEmbed(
        `🛠 Server Configuration for ${server.guild.name} 🛠`,
        EmbedColor.Aqua,
        `**This is the main menu for server configuration.**\n\n` +
            `Select an option from the drop-down menu below.`
    );
    const selectMenu = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
        new SelectMenuBuilder()
            .setCustomId(
                yabobModalToString(
                    generateSelectMenuId(
                        isDm ? 'dm' : 'other',
                        'server_settings',
                        server.guild.id,
                        channelId
                    )
                )
            )
            .setPlaceholder('Select an option')
            .addOptions(serverSettingsMainMenuOptions.map(option => option.optionObj))
    );
    return { embeds: embed.embeds, components: [selectMenu] };
}

function serverRolesConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean,
    forServerInit = false
): BaseMessageOptions {
    const botAdminRole = server.botAdminRoleID;
    const helperRole = server.helperRoleID;
    const studentRole = server.studentRoleID;

    const embed = SimpleEmbed(
        `🛠 Server Configuration for ${server.guild.name} 🛠`,
        EmbedColor.Aqua,
        (forServerInit
            ? `Thanks for choosing YABOB for helping you with office hours!\n To start using YABOB, it requires the following roles: \n\n`
            : `The server roles configuration is as follows:\n\n`) +
            `**Bot Admin Role:** ${
                forServerInit
                    ? ` Role that can manage the bot and it's settings\n`
                    : botAdminRole === 'Not Set'
                    ? 'Not Set'
                    : botAdminRole === 'Deleted'
                    ? '@deleted-role'
                    : `<@&${botAdminRole}>`
            }\n` +
            `**Helper Role:** ${
                forServerInit
                    ? ` Role that allows users to host office hours\n`
                    : helperRole === 'Not Set'
                    ? 'Not Set'
                    : helperRole === 'Deleted'
                    ? '@deleted-role'
                    : `<@&${helperRole}>`
            }\n` +
            `**Student Role:** ${
                forServerInit
                    ? ` Role that allows users to join office hour queues\n`
                    : studentRole === 'Not Set'
                    ? 'Not Set'
                    : studentRole === 'Deleted'
                    ? '@deleted-role'
                    : `<@&${studentRole}>`
            }\n\n` +
            `Select an option below to change the configuration.\n\n` +
            `**1** - Use existing roles named the same as the missing roles. If not found create new roles\n` +
            `**⤷ A** - Use the @everyone role for the Student role if missing\n` +
            `**2** - Create brand new roles for the missing roles\n` +
            `**⤷ A** - Use the @everyone role for the Student role if missing\n` +
            `If you want to set the roles manually, use the \`/set_roles\` command.`
    );

    function composeSSRCButtonId(optionNumber: string): string {
        const newYabobButton = generateYabobButtonId(
            isDm ? 'dm' : 'other',
            `ssrc${optionNumber}`,
            server.guild.id,
            channelId
        );
        return yabobButtonToString(newYabobButton);
    }

    // ssrc = server_settings_roles_config_. shortened due to limited customId length

    const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeSSRCButtonId('1'))
                .setLabel('1')
                .setStyle(ButtonStyle.Secondary)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeSSRCButtonId('1a'))
                .setLabel('1A')
                .setStyle(ButtonStyle.Secondary)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeSSRCButtonId('2'))
                .setLabel('2')
                .setStyle(ButtonStyle.Secondary)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeSSRCButtonId('2a'))
                .setLabel('2A')
                .setStyle(ButtonStyle.Secondary)
        );

    return { embeds: embed.embeds, components: [buttons] };
}

function afterSessionMessageConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): BaseMessageOptions {
    const embed = SimpleEmbed(
        `🛠 Server Configuration for ${server.guild.name} 🛠`,
        EmbedColor.Aqua,
        `The after session message configuration is as follows:\n\n` +
            `**After Session Message:**\n\n ${
                server.afterSessionMessage === ''
                    ? '`Not Set`'
                    : server.afterSessionMessage
            }\n\n` +
            `Select an option below to change the configuration.\n\n` +
            `**⚙️** - Set the after session message\n` +
            `**🔒** - Disable the after session message\n`
    );

    // asmc = after_session_message_config_. shortened due to limited customId length

    function composeASMCButtonId(optionNumber: string): string {
        const newYabobButton = generateYabobButtonId(
            isDm ? 'dm' : 'other',
            `asmc${optionNumber}`,
            server.guild.id,
            channelId
        );
        return yabobButtonToString(newYabobButton);
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeASMCButtonId('1'))
                .setEmoji('⚙️')
                .setStyle(ButtonStyle.Secondary)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeASMCButtonId('2'))
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary)
        );

    return { embeds: embed.embeds, components: [buttons] };
}

function queueAutoClearConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): BaseMessageOptions {
    const embed = SimpleEmbed(
        `🛠 Server Configuration for ${server.guild.name} 🛠`,
        EmbedColor.Aqua,
        `The queue auto clear configuration is as follows:\n\n` +
            `**Queue Auto Clear:** ${
                server.queueAutoClearTimeout === 'AUTO_CLEAR_DISABLED' ||
                server.queueAutoClearTimeout === undefined
                    ? '`Not Set`'
                    : `${server.queueAutoClearTimeout.hours}h ${server.queueAutoClearTimeout.minutes}min`
            }\n\n` +
            `Select an option below to change the configuration.\n\n` +
            `**⚙️** - Set the queue auto clear\n` +
            `**🔒** - Disable the queue auto clear\n`
    );

    // qacc = queue_auto_clear_config_. shortened due to limited customId length

    function composeQACCButtonId(optionNumber: string): string {
        const newYabobButton = generateYabobButtonId(
            isDm ? 'dm' : 'other',
            `qacc${optionNumber}`,
            server.guild.id,
            channelId
        );
        return yabobButtonToString(newYabobButton);
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeQACCButtonId('1'))
                .setEmoji('⚙️')
                .setStyle(ButtonStyle.Secondary)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId(composeQACCButtonId('2'))
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary)
        );

    return { embeds: embed.embeds, components: [buttons] };
}

function loggingChannelConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): BaseMessageOptions {
    const embed = SimpleEmbed(
        `🛠 Server Configuration for ${server.guild.name} 🛠`,
        EmbedColor.Aqua,
        `The logging channel configuration is as follows:\n\n` +
            `**Logging Channel:** ${
                server.loggingChannel === undefined
                    ? '`Not Set`'
                    : server.loggingChannel.toString()
            }\n\n` +
            `Select an option below to change the configuration.\n\n` +
            `**Use the \`/set_logging_channel\`** - Choose the channel you want YABOB to log to\n` +
            `**🔒** - Disable the logging channel\n`
    );

    // lcc = logging_channel_config_. shortened due to limited customId length

    function composeLCCButtonId(optionNumber: string): string {
        const newYabobButton = generateYabobButtonId(
            isDm ? 'dm' : 'other',
            `lcc${optionNumber}`,
            server.guild.id,
            channelId
        );
        return yabobButtonToString(newYabobButton);
    }

    // TODO: Implement a direct way to change the logging channel

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(composeLCCButtonId('2'))
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: embed.embeds, components: [buttons] };
}

export {
    serverSettingsMainMenu,
    serverSettingsMainMenuOptions,
    serverRolesConfigMenu,
    afterSessionMessageConfigMenu,
    queueAutoClearConfigMenu,
    loggingChannelConfigMenu
};
