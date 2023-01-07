/**
 * @packageDocumentation
 * This file contains functions that make guild-level changes
 *  that don't directly affect AttendingServerV2's internal state
 */

import {
    CategoryChannel,
    ChannelType,
    Guild,
    GuildMember,
    Snowflake,
    VoiceBasedChannel
} from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../utils/embed-helper.js';
import { client } from '../global-states.js';
import { cyan, yellow, magenta } from '../utils/command-line-colors.js';
import { commandChannelConfigs } from './command-ch-constants.js';
import { isCategoryChannel, isTextChannel } from '../utils/util-functions.js';
import { ExpectedServerErrors } from './expected-server-errors.js';
import { HierarchyRoles } from '../models/hierarchy-roles.js';

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
                    `Please go to ${guild.name}'s Server settings → Roles and change ${client.user.username} ` +
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
async function updateCommandHelpChannels(
    guild: Guild,
    hierarchyRoleIds: HierarchyRoles
): Promise<void> {
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
            commandChannelConfigs.map(async roleConfig => {
                const commandHelpChannel = await helpCategory.children.create({
                    name: roleConfig.channelName
                });
                await commandHelpChannel.permissionOverwrites.create(
                    guild.roles.everyone,
                    {
                        SendMessages: false,
                        ViewChannel: false
                    }
                );
                const rolesWithViewPermission = roleConfig.visibility
                    // elements of visibility are keys of hierarchyRoleIds
                    .map(key => hierarchyRoleIds[key])
                    // now get role by id
                    .map(id => guild.roles.cache.get(id));
                await Promise.all(
                    rolesWithViewPermission.map(role => {
                        role &&
                            commandHelpChannel.permissionOverwrites.create(role, {
                                ViewChannel: true
                            });
                    })
                );
            })
        );
        await sendCommandHelpChannelMessages(helpCategory);
    } else {
        console.log(
            `Found existing help channels in ${yellow(
                guild.name
            )}, updating command help files`
        );
        await sendCommandHelpChannelMessages(existingHelpCategory);
    }
    console.log(magenta(`✓ Updated help channels on ${guild.name} ✓`));
}

/**
 * Overwrites the existing command help channel and send new help messages
 * @param helpCategory the category named 'Bot Commands Help'
 */
async function sendCommandHelpChannelMessages(
    helpCategory: CategoryChannel
): Promise<void> {
    const allHelpChannels = helpCategory.children.cache.filter(isTextChannel);
    await Promise.all(
        allHelpChannels
            .map(channel =>
                channel.messages
                    .fetch()
                    .then(messages => messages.map(msg => msg.delete()))
            )
            .flat()
    );
    // send new ones
    await Promise.all(
        allHelpChannels.map(channel =>
            commandChannelConfigs
                .find(val => val.channelName === channel.name)
                ?.helpMessages.filter(helpMessage => helpMessage.useInHelpChannel)
                .map(helpMessage => channel.send(helpMessage.message))
        )
    );
    console.log(`Successfully updated help messages in ${yellow(helpCategory.name)}!`);
}

/**
 * Updates the command help channel visibility when hierarchy roles get updated
 * @param guild
 * @param hierarchyRoleIds the newly updated hierarchy role ids
 */
async function updateCommandHelpChannelVisibility(
    guild: Guild,
    hierarchyRoleIds: HierarchyRoles
): Promise<void> {
    const helpCategory = guild.channels.cache.find(
        (channel): channel is CategoryChannel =>
            isCategoryChannel(channel) && channel.name === 'Bot Commands Help'
    );
    if (!helpCategory) {
        await updateCommandHelpChannels(guild, hierarchyRoleIds);
        return;
    }
    const helpChannels = (await helpCategory.fetch()).children.cache.filter(
        isTextChannel
    );
    await Promise.all(
        helpChannels
            .map(helpChannel =>
                helpChannel.permissionOverwrites.cache.map(overwrite =>
                    overwrite.delete()
                )
            )
            .flat()
    );
    await Promise.all(
        helpChannels.map(channel =>
            commandChannelConfigs
                .find(channelConfig => channelConfig.channelName === channel.name)
                ?.visibility.map(key => hierarchyRoleIds[key])
                ?.map(roleId =>
                    channel.permissionOverwrites.create(roleId, {
                        ViewChannel: true
                    })
                )
        )
    );
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
    officeNamePrefix: string,
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
                    name: `${officeNamePrefix} ${officeNumber + 1}`,
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

/**
 * Sends the VC invite to the student after successful dequeue
 * @param student who will receive the invite
 * @param helperVoiceChannel which vc channel to invite the student to
 */
async function sendInvite(
    student: GuildMember,
    helperVoiceChannel: VoiceBasedChannel
): Promise<void> {
    const [invite] = await Promise.all([
        helperVoiceChannel.createInvite({
            maxAge: 15 * 60,
            maxUses: 1
        }),
        helperVoiceChannel.permissionOverwrites.create(student, {
            ViewChannel: true,
            Connect: true
        })
    ]);
    await student.send(
        SimpleEmbed(
            `It's your turn! Join the call: ${invite.toString()}`,
            EmbedColor.Success
        )
    );
    // remove the overwrite when the link dies
    setTimeout(() => {
        helperVoiceChannel.permissionOverwrites.cache
            .find(overwrite => overwrite.id === student.id)
            ?.delete()
            .catch(() =>
                console.error(`Failed to delete overwrite for ${student.displayName}`)
            );
    }, 15 * 60 * 1000);
}

export {
    initializationCheck,
    updateCommandHelpChannels,
    updateCommandHelpChannelVisibility,
    createOfficeVoiceChannels,
    sendInvite
};
