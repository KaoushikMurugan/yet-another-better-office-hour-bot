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
    MessageFlags,
    PermissionFlagsBits,
    Snowflake,
    VoiceBasedChannel
} from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../utils/embed-helper.js';
import { client, LOGGER } from '../global-states.js';
import { red } from '../utils/command-line-colors.js';
import { helpChannelConfigurations } from './command-ch-constants.js';
import { isCategoryChannel, isTextChannel } from '../utils/util-functions.js';
import { ExpectedServerErrors } from './expected-server-errors.js';
import { AccessLevelRoleIds } from '../models/access-level-roles.js';
import type { ServerError } from '../utils/error-types.js';
import type { Result } from '../utils/type-aliases.js';

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
        throw Error(red("YABOB doesn't have admin permission."));
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
        throw Error(red("YABOB doesn't have highest role."));
    }
}

/**
 * Updates the help channel messages & permissions
 * Removes all messages in the help channel and posts new ones
 * @param guild
 * @param accessLevelRoleIds the access level role ids used to configure visibility
 */
async function updateCommandHelpChannels(
    guild: Guild,
    accessLevelRoleIds: AccessLevelRoleIds
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
        LOGGER.info(`Found no help channels in ${guild.name}. Creating new ones.`);
        const helpCategory = await guild.channels.create({
            name: 'Bot Commands Help',
            type: ChannelType.GuildCategory
        });
        // Only create the channels, let setHelpChannelVisibility control the permissions
        await Promise.all(
            helpChannelConfigurations.map(helpChannelConfig =>
                helpCategory.children.create({
                    name: helpChannelConfig.channelName
                })
            )
        );
        Promise.all([
            sendHelpChannelMessages(helpCategory),
            setHelpChannelVisibility(guild, accessLevelRoleIds)
        ])
            .then(() => LOGGER.info(`✓ Updated help channels on ${guild.name} ✓`))
            .catch(err => LOGGER.error(err, 'Failed to update help messages'));
    } else {
        LOGGER.info(
            `Found existing help channels in ${guild.name}, updating command help files`
        );
        Promise.all([
            sendHelpChannelMessages(existingHelpCategory),
            setHelpChannelVisibility(guild, accessLevelRoleIds)
        ])
            .then(() => LOGGER.info(`✓ Updated help channels on ${guild.name} ✓`))
            .catch(err => LOGGER.error(err, 'Failed to update help messages'));
    }
}

/**
 * Overwrites the existing command help channel and send new help messages
 * @remark the async calls in this function are very slow,
 *  so the callee should use callbacks instead of await
 * @param helpCategory the category named 'Bot Commands Help'
 */
async function sendHelpChannelMessages(helpCategory: CategoryChannel): Promise<void> {
    const allHelpChannels = helpCategory.children.cache.filter(isTextChannel);
    await Promise.all(
        allHelpChannels.map(async channel => {
            const messages = await channel.messages.fetch();
            await Promise.all(messages.map(msg => msg.delete()));
        })
    );
    // send the messages we want to show in the help channels
    await Promise.all(
        allHelpChannels.map(
            channel =>
                helpChannelConfigurations
                    .find(val => val.channelName === channel.name)
                    ?.helpMessages.filter(helpMessage => helpMessage.useInHelpChannel)
                    .map(helpMessage => ({
                        ...helpMessage,
                        message: {
                            ...helpMessage.message,
                            flags: MessageFlags.SuppressNotifications as const
                        }
                    }))
                    .map(helpMessage => channel.send(helpMessage.message))
        )
    );
    LOGGER.info(
        `Successfully updated help messages in ${helpCategory.name} in ${helpCategory.guild.name}!`
    );
}

/**
 * Sets the command help channel visibility with the given role ids;
 *  Delete all existing permission overwrites, then create new ones
 * @remark the async calls in this function are very slow, so callee should attach .catch() callback instead of await
 * @param guild
 * @param accessLevelRoleIds the newly updated access level role ids
 */
async function setHelpChannelVisibility(
    guild: Guild,
    accessLevelRoleIds: AccessLevelRoleIds
): Promise<void> {
    const helpCategory = guild.channels.cache.find(
        (channel): channel is CategoryChannel =>
            isCategoryChannel(channel) && channel.name === 'Bot Commands Help'
    );
    if (!helpCategory) {
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
    if (!guild.roles.cache.hasAll(...Object.values(accessLevelRoleIds))) {
        // if some of the roles are not set, all channels visible to everyone
        // temporary solution
        await Promise.all(
            helpChannels.map(channel =>
                channel.permissionOverwrites.create(guild.roles.everyone, {
                    ViewChannel: true
                })
            )
        );
        return;
    }
    // make the channel invisible to @everyone first
    await Promise.all(
        helpChannels.map(channel =>
            channel.permissionOverwrites.create(guild.roles.everyone, {
                ViewChannel: false
            })
        )
    );
    await Promise.all(
        helpChannels.map(
            channel =>
                helpChannelConfigurations
                    .find(channelConfig => channelConfig.channelName === channel.name)
                    ?.visibility.map(key => accessLevelRoleIds[key])
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
 * @param guild
 * @param categoryName the name of the category containing the voice channels
 * @param officeNamePrefix prefix of each voice channel
 * @param numberOfOffices number of offices to create
 * @param permittedRoleIds the Snowflakes of Bot Admin and Staff
 * @example
 * createOfficeCategory('Office Hours', 'Office', 3)  will create a
 * category named 'Office Hours' with 3 voice channels named 'Office 1', 'Office 2' and 'Office 3'
 */
async function createOfficeVoiceBasedChannels(
    guild: Guild,
    categoryName: string,
    officeNamePrefix: string,
    numberOfOffices: number,
    permittedRoleIds: [Snowflake, Snowflake]
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
    await Promise.all(
        Array(numberOfOffices)
            .fill(undefined)
            .map((_, officeNumber) =>
                officeCategory.children.create({
                    name: `${officeNamePrefix} ${officeNumber + 1}`,
                    type: ChannelType.GuildVoice,
                    // create the permission overwrites along with the channel itself
                    permissionOverwrites: [
                        {
                            deny: PermissionFlagsBits.SendMessages,
                            id: guild.roles.everyone
                        },
                        {
                            deny: PermissionFlagsBits.ViewChannel,
                            id: guild.roles.everyone
                        },
                        ...permittedRoleIds.map(id => ({
                            allow: PermissionFlagsBits.ViewChannel,
                            id: id
                        }))
                    ]
                })
            )
    );
}

/**
 * Sends the VBC invite to the student after successful dequeue
 * Only sends if student isn't in the vc already
 * @param student who will receive the invite
 * @param helperVoiceBasedChannel which vc channel to invite the student to
 * @returns a tagged union of whether the invite is successfully sent
 */
async function sendInviteIfNotInVBC(
    student: GuildMember,
    helperVoiceBasedChannel: VoiceBasedChannel
): Promise<Result<void, ServerError>> {
    if (student.voice.channelId === helperVoiceBasedChannel.id) {
        return { ok: true, value: undefined };
    }
    const [invite] = await Promise.all([
        helperVoiceBasedChannel.createInvite({
            maxAge: 15 * 60,
            maxUses: 1
        }),
        helperVoiceBasedChannel.permissionOverwrites.create(student, {
            ViewChannel: true,
            Connect: true
        })
    ]);
    // remove the overwrite when the link dies
    setTimeout(
        () => {
            helperVoiceBasedChannel.permissionOverwrites.cache
                .find(overwrite => overwrite.id === student.id)
                ?.delete()
                .catch(() =>
                    LOGGER.error(`Failed to delete overwrite for ${student.displayName}`)
                );
        },
        15 * 60 * 1000
    );
    try {
        await student.send(
            SimpleEmbed(
                `It's your turn! Join the call: ${invite.toString()}`,
                EmbedColor.Success
            )
        );
    } catch {
        return {
            ok: false,
            error: ExpectedServerErrors.studentBlockedDm(student.id)
        };
    }
    return { ok: true, value: undefined };
}

export {
    initializationCheck,
    updateCommandHelpChannels,
    setHelpChannelVisibility,
    createOfficeVoiceBasedChannels,
    sendInviteIfNotInVBC
};
