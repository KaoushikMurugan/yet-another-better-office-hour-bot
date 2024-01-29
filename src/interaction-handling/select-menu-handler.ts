import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
    StringSelectMenuInteraction
} from 'discord.js';
import {serverSettingsMainMenuOptions, SettingsSwitcher} from '../attending-server/server-settings-menus.js';
import {isTextChannel, longestCommonSubsequence} from '../utils/util-functions.js';
import { SelectMenuHandlerProps } from './handler-interface.js';
import { ExpectedParseErrors } from './interaction-constants/expected-interaction-errors.js';
import { SelectMenuNames} from './interaction-constants/interaction-names.js';
import { AttendingServer } from '../attending-server/base-attending-server.js';
import { adminCommandHelpMessages } from '../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../help-channel-messages/StudentCommands.js';
import { ReturnToHelpMainAndSubMenuButton } from './shared-interaction-functions.js';
import { AccessLevelRole } from '../models/access-level-roles.js';
import { QuickStartLoggingChannel } from '../attending-server/quick-start-pages.js';

const baseYabobSelectMenuMap: SelectMenuHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {
            [SelectMenuNames.ServerSettings]: showSettingsSubMenu,
            [SelectMenuNames.SelectLoggingChannelSM]: interaction =>
                selectLoggingChannel(interaction, 'settings'),
            [SelectMenuNames.SelectLoggingChannelQS]: interaction =>
                selectLoggingChannel(interaction, 'quickStart'),
            [SelectMenuNames.InPersonRoomMenu]: selectInPersonRoom,
            [SelectMenuNames.HelpMenu]: selectHelpCommand
        }
    },
    dmMethodMap: {},
    skipProgressMessageSelectMenus: new Set([
        SelectMenuNames.ServerSettings,
        SelectMenuNames.SelectLoggingChannelSM,
        SelectMenuNames.SelectLoggingChannelQS,
        SelectMenuNames.InPersonRoomMenu,
        SelectMenuNames.HelpMenu
    ])
};

/**
 * Display the submenu of the selected option
 * @param interaction
 */
async function showSettingsSubMenu(
    interaction: StringSelectMenuInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const selectedOption = interaction.values[0];
    const callbackMenu = serverSettingsMainMenuOptions.find(
        option => option.selectMenuOptionData.value === selectedOption
    )?.menu;
    if (!callbackMenu) {
        throw new Error(`Invalid option selected: ${selectedOption}`);
    }
    await interaction.update(callbackMenu(server, false, undefined));
}

/**
 * Set the logging channel to the selected channel from the select menu
 * @param interaction
 */
async function selectLoggingChannel(
    interaction: StringSelectMenuInteraction<'cached'>,
    parent: 'settings' | 'quickStart'
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const channelId = interaction.values[0];
    const loggingChannel = server.guild.channels.cache.get(channelId ?? '');
    const callbackMenu = serverSettingsMainMenuOptions.find(
        option => option.selectMenuOptionData.value === 'logging-channel'
    );
    if (!loggingChannel || !isTextChannel(loggingChannel)) {
        throw ExpectedParseErrors.nonExistentTextChannel(channelId);
    }
    if (!callbackMenu) {
        throw new Error('Invalid option selected:');
    }
    await server.setLoggingChannel(loggingChannel);
    if (parent === 'settings') {
        await interaction.update(
            callbackMenu.menu(server, false, 'Logging channel has been updated!')
        );
    } else {
        await interaction.update(
            QuickStartLoggingChannel(server, 'Logging channel has been updated!')
        );
    }
}

/**
* Select an in-person room from the list of rooms
* @param interaction
*/
async function selectInPersonRoom(
    interaction: StringSelectMenuInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const selectedOption = interaction.values[0];
    if (!selectedOption) {
        throw new Error('Invalid option selected:');
    }
    const id = interaction.channel?.parent?.id;
    if (!id) {
        throw new Error('Invalid option selected:');
    }
    await server.getInPersonQueueById(id, selectedOption).enqueue(interaction.member);
}

/**
 * Display the help message for the selected option
 * @param interaction
 */
async function selectHelpCommand(
    interaction: StringSelectMenuInteraction<'cached'>
): Promise<void> {
    const server = AttendingServer.get(interaction.guildId);
    const selectedOption = interaction.values[0];
    const allHelpMessages = adminCommandHelpMessages.concat(
        helperCommandHelpMessages.concat(studentCommandHelpMessages)
    );

    // find the help message that matches the selected option
    const helpMessage = allHelpMessages.find(
        helpMessage => helpMessage.nameValuePair.value === selectedOption
    );

    if (!helpMessage) {
        throw new Error(`Invalid option selected: ${selectedOption}`);
    }

    // Long way for now since I'm not sure where to store what submenu you came from

    let subMenu: AccessLevelRole = 'student';

    if (adminCommandHelpMessages.includes(helpMessage)) {
        subMenu = 'botAdmin';
    } else if (helperCommandHelpMessages.includes(helpMessage)) {
        subMenu = 'staff';
    } else if (studentCommandHelpMessages.includes(helpMessage)) {
        subMenu = 'student';
    }

    await interaction.update({
        embeds: helpMessage.message.embeds,
        components: [ReturnToHelpMainAndSubMenuButton(server, subMenu)]
    });
}

export { baseYabobSelectMenuMap };
