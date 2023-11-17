import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands.js';
import { buildComponent } from '../utils/component-id-factory.js';
import { EmbedColor } from '../utils/embed-helper.js';
import { YabobEmbed } from '../utils/type-aliases.js';
import {
    ButtonNames,
    SelectMenuNames
} from './interaction-constants/interaction-names.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';
import { AccessLevelRole } from '../models/access-level-roles.js';

/**
 * Creates the help main menu embed. Displays buttons to redirect to a submenu
 * @param server
 * @param viewMode
 * @returns
 */
function HelpMainMenuEmbed(
    server: AttendingServerV2,
    viewMode: AccessLevelRole = 'student'
): YabobEmbed {
    // If student, jump to student help menu since it is the only one they can see
    if (viewMode === 'student') {
        return HelpSubMenuEmbed(server, 0, viewMode);
    }

    const embed = new EmbedBuilder()
        .setTitle('Help Main Menu')
        .setColor(EmbedColor.Pink)
        .setDescription('Select a button below to view the help menu for that category.');

    const buttons = new ActionRowBuilder<ButtonBuilder>();

    if (viewMode === 'botAdmin') {
        embed.addFields([
            {
                name: ' 👮 Bot Admin Commands',
                value: 'Commands for bot admins to use to manage the bot.'
            }
        ]);
        buttons.addComponents(
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.HelpMenuBotAdmin,
                server.guild.id
            ])
                .setStyle(ButtonStyle.Primary)
                .setLabel('Bot Admin Commands')
                .setEmoji('👮')
        );
    }

    // Helper commands
    embed.addFields([
        {
            name: '👨‍🏫 Helper Commands',
            value: 'Commands for helpers to use to manage the help channels.'
        }
    ]);
    buttons.addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.HelpMenuStaff,
            server.guild.id
        ])
            .setStyle(ButtonStyle.Primary)
            .setLabel('Helper Commands')
            .setEmoji('👨‍🏫')
    );

    // Student commands
    embed.addFields([
        {
            name: '👨‍🎓 Student Commands',
            value: 'Commands for students to use to interact with the help channels.'
        }
    ]);

    buttons.addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.HelpMenuStudent,
            server.guild.id
        ])
            .setStyle(ButtonStyle.Primary)
            .setLabel('Student Commands')
            .setEmoji('👨‍🎓')
    );

    return {
        embeds: [embed],
        components: [buttons]
    };
}

/**
 * Composes the help embed
 * @param page The page number of the help menu. 0 is home page
 */
function HelpSubMenuEmbed(
    server: AttendingServerV2,
    page: number,
    subMenu: AccessLevelRole = 'student'
): YabobEmbed {
    // get all the help messages
    //TODO: create file with help message utils
    const allHelpMessages = (
        subMenu === 'botAdmin'
            ? adminCommandHelpMessages
            : subMenu === 'staff'
              ? helperCommandHelpMessages
              : studentCommandHelpMessages
    ).filter(helpMessage => helpMessage.useInHelpCommand === true);

    const embed = new EmbedBuilder()
        .setTitle(
            `${
                subMenu === 'botAdmin'
                    ? '👮 Bot Admin'
                    : subMenu === 'staff'
                      ? '👨‍🏫 Staff'
                      : '👨‍🎓 Student'
            } Help Menu`
        )
        .setColor(EmbedColor.Pink)
        .setDescription(
            'This is the help menu for YABOB. Use the buttons below to navigate through the menu.'
        );

    const numPages = Math.ceil(allHelpMessages.length / 25);
    if (numPages > 1) {
        embed.setFooter({
            text: `Page ${page + 1}/${numPages}`
        });
    }

    return {
        embeds: [embed],
        components:
            Math.floor(allHelpMessages.length / 25) >= 2 // Only show the turn page buttons if there are 2 or more pages
                ? [
                      HelpMenuButtons(
                          server,
                          page,
                          Math.floor(allHelpMessages.length / 25)
                      ),
                      HelpMenuSelectMenu(server, page, subMenu),
                      ReturnToHelpMainMenuButton(server)
                  ]
                : [
                      HelpMenuSelectMenu(server, page, subMenu),
                      ReturnToHelpMainMenuButton(server)
                  ]
    };
}

/**
 * Creates the buttons for the help menu
 */
function HelpMenuButtons(
    server: AttendingServerV2,
    page: number,
    maxPage: number
): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.HelpMenuLeft,
            server.guild.id
        ])
            .setStyle(ButtonStyle.Primary)
            .setLabel('Previous')
            .setEmoji('⬅️')
            .setDisabled(page === 0),
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.HelpMenuRight,
            server.guild.id
        ])
            .setStyle(ButtonStyle.Primary)
            .setLabel('Next')
            .setEmoji('➡️')
            .setDisabled(page === maxPage)
    );
}

/**
 * Creates the select menu for the help menu
 * @param server
 * @param page
 * @returns
 */
function HelpMenuSelectMenu(
    server: AttendingServerV2,
    page: number,
    subMenu: AccessLevelRole = 'student'
): ActionRowBuilder<StringSelectMenuBuilder> {
    const allHelpMessages = (
        subMenu === 'botAdmin'
            ? adminCommandHelpMessages
            : subMenu === 'staff'
              ? helperCommandHelpMessages
              : studentCommandHelpMessages
    ).filter(helpMessage => helpMessage.useInHelpCommand);

    const pageHelpMessages = allHelpMessages.slice(page * 25, (page + 1) * 25);

    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        buildComponent(new StringSelectMenuBuilder(), [
            'other',
            SelectMenuNames.HelpMenu,
            server.guild.id
        ]).addOptions(
            pageHelpMessages.map(helpMessage => {
                return {
                    label: helpMessage.nameValuePair.name,
                    value: helpMessage.nameValuePair.value,
                    emoji: helpMessage.emoji,
                    default: false
                };
            })
        )
    );

    return selectMenu;
}

/**
 * Creates the return to help menu button
 * @param server
 * @returns
 */
function ReturnToHelpMainMenuButton(
    server: AttendingServerV2
): ActionRowBuilder<ButtonBuilder> {
    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.ReturnToHelpMainMenu,
            server.guild.id
        ])
            .setStyle(ButtonStyle.Primary)
            .setLabel('Return to Main Menu')
            .setEmoji('🏠')
    );

    return button;
}

function ReturnToHelpMainAndSubMenuButton(
    server: AttendingServerV2,
    subMenu: AccessLevelRole = 'student'
): ActionRowBuilder<ButtonBuilder> {
    const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ReturnToHelpMainMenu,
                server.guild.id
            ])
                .setStyle(ButtonStyle.Primary)
                .setLabel('Return to Main Menu')
                .setEmoji('🏠')
        )
        .addComponents(
            buildComponent(new ButtonBuilder(), [
                'other',
                subMenu === 'botAdmin'
                    ? ButtonNames.ReturnToHelpAdminSubMenu
                    : subMenu === 'staff'
                      ? ButtonNames.ReturnToHelpStaffSubMenu
                      : ButtonNames.ReturnToHelpStudentSubMenu,
                server.guild.id
            ])
                .setStyle(ButtonStyle.Primary)
                .setLabel(
                    `Return to ${
                        subMenu === 'botAdmin'
                            ? 'Admin'
                            : subMenu === 'staff'
                              ? 'Staff'
                              : 'Student'
                    } Help Menu`
                )
                .setEmoji('🏠')
        );

    return buttons;
}

export {
    HelpMainMenuEmbed,
    HelpSubMenuEmbed,
    HelpMenuSelectMenu,
    ReturnToHelpMainMenuButton,
    ReturnToHelpMainAndSubMenuButton
};
