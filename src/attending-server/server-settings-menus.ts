import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SelectMenuBuilder,
    SelectMenuComponentOptionData
} from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../utils/embed-helper.js';
import { SettingsMenuCallback, YabobEmbed } from '../utils/type-aliases.js';
import { buttonFactory, selectMenuFactory } from '../utils/component-id-factory.js';
import { AttendingServerV2 } from './base-attending-server.js';

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
    },
    {
        optionObj: {
            emoji: '🎓',
            label: 'Auto Give Student Role',
            description: 'Configure the auto-giving of the student role',
            value: 'auto-give-student-role'
        },
        subMenu: autoGiveStudentRoleConfigMenu
    }
];

const mainMenuRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    buttonFactory
        .buildComponent('other', 'return_to_main_menu', undefined, undefined)
        .setEmoji('🏠')
        .setLabel('Return to Main Menu')
        .setStyle(ButtonStyle.Primary)
);

/**
 * Composes the server settings main menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function serverSettingsMainMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const embed = SimpleEmbed(
        `🛠 Server Settings for ${server.guild.name} 🛠`,
        EmbedColor.Aqua,
        `**This is the main menu for server settings.**\n\n` +
            `Select an option from the drop-down menu below.`
    );
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
    return { embeds: embed.embeds, components: [selectMenu] };
}

/**
 * Composes the server roles configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @param forServerInit
 * @returns
 */
function serverRolesConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean,
    forServerInit = false
): YabobEmbed {
    const embed = SimpleEmbed(
        `📝 Server Roles Configuration for ${server.guild.name} 📝`,
        EmbedColor.Aqua,
        (forServerInit
            ? `**Thanks for choosing YABOB for helping you with office hours!\n To start using YABOB, it requires the following roles: **\n`
            : '') +
            `**\n🤖 Bot Admin Role:** ${
                forServerInit
                    ? ` *Role that can manage the bot and it's settings*\n`
                    : server.botAdminRoleID === 'Not Set'
                    ? 'Not Set'
                    : server.botAdminRoleID === 'Deleted'
                    ? '@deleted-role'
                    : `<@&${server.botAdminRoleID}>`
            }\n\n` +
            `**📚 Helper Role:** ${
                forServerInit
                    ? ` *Role that allows users to host office hours*\n`
                    : server.helperRoleID === 'Not Set'
                    ? 'Not Set'
                    : server.helperRoleID === 'Deleted'
                    ? '@deleted-role'
                    : `<@&${server.helperRoleID}>`
            }\n\n` +
            `**🎓 Student Role:** ${
                forServerInit
                    ? ` *Role that allows users to join office hour queues*\n`
                    : server.studentRoleID === 'Not Set'
                    ? 'Not Set'
                    : server.studentRoleID === 'Deleted'
                    ? '@deleted-role'
                    : `<@&${server.studentRoleID}>`
            }\n\n` +
            `***Select an option from below to change the configuration:***\n\n` +
            `**1** - Use existing roles named the same as the missing roles. If not found create new roles\n` +
            `**⤷ A** - Use the @everyone role for the Student role if missing\n` +
            `**2** - Create brand new roles for the missing roles\n` +
            `**⤷ A** - Use the @everyone role for the Student role if missing\n` +
            `If you want to set the roles manually, use the \`/set_roles\` command.`
    );
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                `server_role_config_1`,
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setLabel('1')
            .setStyle(ButtonStyle.Secondary),
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                `server_role_config_1a`,
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setLabel('1A')
            .setStyle(ButtonStyle.Secondary),
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                `server_role_config_2`,
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setLabel('2')
            .setStyle(ButtonStyle.Secondary),
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                `server_role_config_2a`,
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setLabel('2A')
            .setStyle(ButtonStyle.Secondary)
    );
    return {
        embeds: embed.embeds,
        components: isDm ? [buttons] : [buttons, mainMenuRow]
    };
}

/**
 * Composes the after session message configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function afterSessionMessageConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const embed = SimpleEmbed(
        `📨 After Session Message Configuration for ${server.guild.name} 📨`,
        EmbedColor.Aqua,
        `\n*The after session message is sent to students after they finish their session with a helper (i.e. upon leaving the voice channel)*\n\n` +
            `**The current After Session Message is: **\n\n` +
            `${
                server.afterSessionMessage === ''
                    ? '`Not Set`'
                    : server.afterSessionMessage
            }\n\n` +
            `***Select an option from below to change the configuration:***\n\n` +
            `**⚙️** - Set the after session message\n` +
            `**🔒** - Disable the after session message. The bot will no longer sent the message to students after they finish their session\n`
    );
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttonFactory
            .buildComponent(
                isDm ? 'dm' : 'other',
                'after_session_message_config_1',
                isDm ? server.guild.id : undefined,
                isDm ? channelId : undefined
            )
            .setEmoji('⚙️')
            .setLabel('Set Message')
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

    return { embeds: embed.embeds, components: [buttons, mainMenuRow] };
}

/**
 * Composes the queue auto clear configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function queueAutoClearConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const embed = SimpleEmbed(
        `⏳ Queue Auto Clear Configuration for ${server.guild.name} ⏳`,
        EmbedColor.Aqua,
        (server.queueAutoClearTimeout === 'AUTO_CLEAR_DISABLED' ||
        server.queueAutoClearTimeout === undefined
            ? '**\nThe queue auto clear feature is currently disabled. The queue will not be cleared automatically.**\n\n'
            : `**\nQueues will automatically be cleared after __${`${server.queueAutoClearTimeout.hours}h ${server.queueAutoClearTimeout.minutes}min`}__ since the last time they were closed**\n\n`) +
            `***Select an option from below to change the configuration:***\n\n` +
            `**⚙️** - Set the queue auto clear time\n` +
            `**🔒** - Disable the queue auto clear feature.\n`
    );
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
    return { embeds: embed.embeds, components: [buttons, mainMenuRow] };
}

/**
 * Composes the logging channel configuration menu
 * @param server
 * @param channelId
 * @param isDm
 * @returns
 */
function loggingChannelConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const embed = SimpleEmbed(
        `🪵 Logging Configuration for ${server.guild.name} 🪵`,
        EmbedColor.Aqua,
        `**\nCurrent Logging Channel:** ${
            server.loggingChannel === undefined
                ? '`Not Set`'
                : server.loggingChannel.toString()
        }\n\n` +
            `***Select an option from below to change the configuration:***\n\n` +
            `**The \`/set_logging_channel\` command** - Enter the channel you want YABOB to log to\n` +
            `**🔒** - Disable the logging feature\n`
    );

    // TODO: Implement a direct way to change the logging channel

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

    return { embeds: embed.embeds, components: [buttons, mainMenuRow] };
}

function autoGiveStudentRoleConfigMenu(
    server: AttendingServerV2,
    channelId: string,
    isDm: boolean
): YabobEmbed {
    const embed = SimpleEmbed(
        `🎓 Auto Give Student Role Configuration for ${server.guild.name} 🎓`,
        EmbedColor.Aqua,
        `\n${
            server.autoGiveStudentRole
                ? 'The auto give student role feature is currently **__enabled__**'
                : 'The auto give student role feature is currently **__disabled__**'
        }\n\n` +
            `***Select an option from below to change the configuration:***\n\n` +
            `**🔓** - Enable the auto give student role feature\n` +
            `**🔒** - Disable the auto give student role feature\n`
    );
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

    return { embeds: embed.embeds, components: [buttons, mainMenuRow] };
}

export {
    serverSettingsMainMenu,
    serverSettingsMainMenuOptions,
    serverRolesConfigMenu,
    afterSessionMessageConfigMenu,
    queueAutoClearConfigMenu,
    loggingChannelConfigMenu,
    autoGiveStudentRoleConfigMenu,
    mainMenuRow
};
