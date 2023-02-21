import {
    ActionRowBuilder,
    SelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands.js';
import { buildComponent, UnknownId } from '../utils/component-id-factory.js';
import { EmbedColor } from '../utils/embed-helper.js';
import { YabobEmbed } from '../utils/type-aliases.js';
import {
    ButtonNames,
    SelectMenuNames
} from './interaction-constants/interaction-names.js';
import { AttendingServerV2 } from '../attending-server/base-attending-server.js';

/**
 * Composes the help embed
 * @param page The page number of the help menu. 0 is home page
 */
function HelpMenuEmbed(server: AttendingServerV2, page: number): YabobEmbed {
    // get all the help messages
    //TODO: create file with help message utils
    const allHelpMessages = adminCommandHelpMessages
        .concat(helperCommandHelpMessages.concat(studentCommandHelpMessages))
        .filter(helpMessage => helpMessage.useInHelpCommand === true);

    // create select menu from the help messages
    const selectMenu = HelpMenuSelectMenu(server, page);

    // create left and right buttons

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.HelpMenuLeft,
            server.guild.id,
            UnknownId
        ])
            .setStyle(ButtonStyle.Primary)
            .setLabel('Previvous Page')
            .setEmoji('⬅️')
            .setDisabled(page === 0),
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.HelpMenuRight,
            server.guild.id,
            UnknownId
        ])
            .setStyle(ButtonStyle.Primary)
            .setLabel('Nect Page')
            .setEmoji('➡️')
            .setDisabled(page === Math.floor(allHelpMessages.length / 25))
    );

    const embed = new EmbedBuilder()
        .setTitle('Help Menu')
        .setColor(EmbedColor.Pink)
        .setDescription(
            'This is the help menu for YABOB. Use the buttons below to navigate through the menu.'
        )
        .setFooter({
            text: `Page ${page + 1}/${Math.ceil(allHelpMessages.length / 25)}`
        });

    return {
        embeds: [embed],
        components: [buttons, selectMenu]
    };
}

/**
 * Creates the select menu for the help menu
 * @param server 
 * @param page 
 * @returns 
 */
function HelpMenuSelectMenu(
    server: AttendingServerV2,
    page: number
): ActionRowBuilder<SelectMenuBuilder> {
    const allHelpMessages = adminCommandHelpMessages
        .concat(helperCommandHelpMessages.concat(studentCommandHelpMessages))
        .filter(helpMessage => helpMessage.useInHelpCommand === true);

    const pageHelpMessages = allHelpMessages.slice(page * 25, (page + 1) * 25);

    const selectMenu = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
        buildComponent(new SelectMenuBuilder(), [
            'other',
            SelectMenuNames.HelpMenu,
            server.guild.id,
            UnknownId
        ]).addOptions(
            pageHelpMessages.map(helpMessage => {
                return {
                    label: helpMessage.nameValuePair.name,
                    value: helpMessage.nameValuePair.value,
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
function ReturnToHelpMenuButton(
    server: AttendingServerV2
): ActionRowBuilder<ButtonBuilder> {
    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            ButtonNames.ReturnToHelpMenu,
            server.guild.id,
            UnknownId
        ])
            .setStyle(ButtonStyle.Primary)
            .setLabel('Return to Main Menu')
            .setEmoji('🏠')
    );

    return button;
}

export { HelpMenuEmbed, HelpMenuSelectMenu, ReturnToHelpMenuButton };
