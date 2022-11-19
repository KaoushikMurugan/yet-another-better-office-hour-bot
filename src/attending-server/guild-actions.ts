/**
 * @packageDocumentation
 * This file contains functions that make guild-level changes
 *  that don't directly affect AttendingServerV2's internal state
 */

import { CategoryChannel, ChannelType, Guild, Snowflake } from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../utils/embed-helper.js';
import { client } from '../global-states.js';
import { cyan, yellow, magenta } from '../utils/command-line-colors.js';
import { commandChConfigs } from './command-ch-constants.js';
import { HelpMessage } from '../utils/type-aliases.js';
import { isTextChannel } from '../utils/util-functions.js';
import { ExpectedServerErrors } from './expected-server-errors.js';

/**
 * The very first check to perform when creating a new AttendingServerV2 instance
 * - Used inside AttendingServerV2.create
 */
async function initializationCheck(guild: Guild): Promise<void> {
    if (guild.members.me === null || !guild.members.me.permissions.has('Administrator')) {
        const owner = await guild.fetchOwner();
        await owner.send(
            SimpleEmbed(
                `Sorry, I need full administrator permission for '${guild.name}'`,
                EmbedColor.Error
            )
        );
        await guild.leave();
        throw Error("YABOB doesn't have admin permission.");
    }
    if (guild.members.me.roles.highest.comparePositionTo(guild.roles.highest) < 0) {
        const owner = await guild.fetchOwner();
        await owner.send(
            SimpleEmbed(
                `It seems like I'm joining a server with existing roles. ` +
                    `Please go to server settings -> Roles and change ${client.user.username} ` +
                    `to the highest role.\n`,
                EmbedColor.Error
            )
        );
        throw Error("YABOB doesn't have highest role.");
    }
}

/**
 * Updates the help channel messages
 * Removes all messages in the help channel and posts new ones
 */
async function updateCommandHelpChannels(guild: Guild): Promise<void> {
    const allChannels = await guild.channels.fetch();
    const existingHelpCategory = allChannels.find(
        (channel): channel is CategoryChannel =>
            channel !== null &&
            channel.type === ChannelType.GuildCategory &&
            channel.name === 'Bot Commands Help'
    );
    // If no help category is found, initialize
    if (!existingHelpCategory) {
        console.log(cyan(`Found no help channels in ${guild.name}. Creating new ones.`));
        const helpCategory = await guild.channels.create({
            name: 'Bot Commands Help',
            type: ChannelType.GuildCategory
        });
        // Change the config object and add more functions here if needed
        await Promise.all(
            commandChConfigs.map(async roleConfig => {
                const commandCh = await helpCategory.children.create({
                    name: roleConfig.channelName
                });
                await commandCh.permissionOverwrites.create(guild.roles.everyone, {
                    SendMessages: false,
                    ViewChannel: false
                });
                await Promise.all(
                    guild.roles.cache
                        .filter(role => roleConfig.visibility.includes(role.name))
                        .map(roleWithViewPermission =>
                            commandCh.permissionOverwrites.create(
                                roleWithViewPermission,
                                { ViewChannel: true }
                            )
                        )
                );
            })
        );
        await sendCommandHelpChannelMessages(helpCategory, commandChConfigs);
    } else {
        console.log(
            `Found existing help channels in ${yellow(
                guild.name
            )}, updating command help files`
        );
        await sendCommandHelpChannelMessages(existingHelpCategory, commandChConfigs);
    }
    console.log(magenta(`✓ Updated help channels on ${guild.name} ✓`));
}

/**
 * Overwrites the existing command help channel and send new help messages
 * @param helpCategory the category named 'Bot Commands Help'
 * @param messageContents array of embeds to send to each help channel
 */
async function sendCommandHelpChannelMessages(
    helpCategory: CategoryChannel,
    messageContents: Array<{
        channelName: string;
        file: HelpMessage[];
        visibility: string[];
    }>
): Promise<void> {
    const allHelpChannels = helpCategory.children.cache.filter(isTextChannel);
    await Promise.all(
        allHelpChannels
            .map(ch =>
                ch.messages.fetch().then(messages => messages.map(msg => msg.delete()))
            )
            .flat()
    );
    // send new ones
    await Promise.all(
        allHelpChannels.map(channel =>
            messageContents
                .find(val => val.channelName === channel.name)
                ?.file?.filter(helpMessage => helpMessage.useInHelpChannel)
                .map(helpMessage => channel.send(helpMessage.message))
        )
    );
    console.log(`Successfully updated help messages in ${yellow(helpCategory.name)}!`);
}
/**
 * Creates a new category with `categoryName` and creates `numOfChannels` voice channels
 * with the name `channelName` within the category
 * @remark createOfficeCategory('Office Hours', 'Office', 3)  will create a
 * category named 'Office Hours' with 3 voice channels named 'Office 1', 'Office 2' and 'Office 3'
 */
async function createOfficeVoiceChannels(
    guild: Guild,
    categoryName: string,
    officeName: string,
    numberOfOffices: number,
    permittedRoles: Snowflake[]
): Promise<void> {
    const allChannels = await guild.channels.fetch();
    // Find if a category with the same name exists
    const existingOfficeCategory = allChannels.filter(
        (channel): channel is CategoryChannel =>
            channel !== null &&
            channel.type === ChannelType.GuildCategory &&
            channel.name === categoryName
    );
    if (existingOfficeCategory.size !== 0) {
        throw ExpectedServerErrors.categoryAlreadyExists(categoryName);
    }
    // If no help category is found, initialize
    const officeCategory = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory
    });
    // Change the config object and add more functions here if needed
    await Promise.all(
        Array(numberOfOffices)
            .fill(undefined)
            .map(async (_, officeNumber) => {
                const officeCh = await officeCategory.children.create({
                    name: `${officeName} ${officeNumber + 1}`,
                    type: ChannelType.GuildVoice
                });
                await officeCh.permissionOverwrites.create(guild.roles.everyone, {
                    SendMessages: false,
                    ViewChannel: false
                });
                await Promise.all(
                    permittedRoles.map(permittedRole =>
                        officeCh.permissionOverwrites.create(permittedRole, {
                            ViewChannel: true
                        })
                    )
                );
            })
    );
}

export { initializationCheck, updateCommandHelpChannels, createOfficeVoiceChannels };
