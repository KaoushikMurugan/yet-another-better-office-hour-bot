import { ActionRowBuilder, SelectMenuBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { adminCommandHelpMessages } from "../../help-channel-messages/AdminCommands.js";
import { helperCommandHelpMessages } from "../../help-channel-messages/HelperCommands.js";
import { studentCommandHelpMessages } from "../../help-channel-messages/StudentCommands.js";
import { buildComponent, UnknownId } from "../utils/component-id-factory.js";
import { SimpleEmbed, EmbedColor } from "../utils/embed-helper.js";
import { YabobEmbed } from "../utils/type-aliases.js";

/**
 * Composes the help embed
 * @param page The page number of the help menu. 0 is home page
 */
function HelpMenuEmbed(page: number): YabobEmbed {

    // get all the help messages
    const allHelpMessages = adminCommandHelpMessages.concat(
        helperCommandHelpMessages.concat(studentCommandHelpMessages)
    );

    // get upto 25 help messages starting from page * 25
    const pageHelpMessages = allHelpMessages.slice(page * 25, (page + 1) * 25);

    // create select menu from the help messages
    const selectMenu = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
        buildComponent(new SelectMenuBuilder(), [
            'other',
            'help-menu-select-' + page,
            UnknownId,
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

    // create left and right buttons

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), [
            'other',
            'help-menu-left-' + page,
            UnknownId,
            UnknownId
        ]).setStyle(ButtonStyle.Primary)
            .setLabel('Left')
            .setDisabled(page === 0),
        buildComponent(new ButtonBuilder(), [
            'other',
            'help-menu-right-' + page,
            UnknownId,
            UnknownId
        ]).setStyle(ButtonStyle.Primary)
            .setLabel('Right')
            .setDisabled(page === Math.floor(allHelpMessages.length / 25))
    );

    return {
        embeds: SimpleEmbed(
            'Help Menu',
            EmbedColor.Pink,
            'This is the help menu for YABOB. Use the buttons below to navigate through the menu.'
        ).embeds,
        components: [buttons, selectMenu]
    };
}

export {
    HelpMenuEmbed
};