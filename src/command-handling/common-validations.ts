/** @module InertactionValidationFunctions */

import {
    ChatInputCommandInteraction,
    GuildMember,
    GuildChannel,
    TextChannel,
    ButtonInteraction,
    ChannelType,
    CategoryChannel,
    ModalSubmitInteraction
} from 'discord.js';
import { QueueChannel } from '../attending-server/base-attending-server';
import { CommandParseError } from '../utils/error-types';
import { ExpectedParseErrors } from './expected-interaction-errors';

/**
 * Checks if the triggerer has the required roles
 * @param commandName the command used
 * @param requiredRoles the roles to check, roles have OR relationship
 * @returns GuildMember object of the triggerer
 * @remark
 * - Use this only on dangerous commands like `/clear_all` because it's slow
 * - Otherwise prefer {@link isTriggeredByUserWithRolesSync}
 */
async function isTriggeredByUserWithRoles(
    interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
    commandName: string,
    requiredRoles: string[]
): Promise<GuildMember> {
    if (interaction.member === null) {
        throw ExpectedParseErrors.nonServerInterction();
    }
    const userRoles = (
        await (interaction.member as GuildMember)?.fetch()
    ).roles.cache.map(role => role.name);
    if (!userRoles.some(role => requiredRoles.includes(role))) {
        throw ExpectedParseErrors.missingHierarchyRoles(requiredRoles, commandName);
    }
    return interaction.member as GuildMember;
}

/**
 * Checks if the triggerer has the required roles.
 * Synchronus version of {@link isTriggeredByUserWithRoles}
 * @param commandName the command used
 * @param requiredRoles the roles to check, roles have OR relationship
 * @returns GuildMember object of the triggerer
 */
function isTriggeredByUserWithRolesSync(
    interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
    commandName: string,
    requiredRoles: string[]
): GuildMember {
    if (interaction.member === null) {
        throw ExpectedParseErrors.nonServerInterction();
    }
    const userRoles = (interaction.member as GuildMember).roles.cache.map(
        role => role.name
    );
    if (!userRoles.some(role => requiredRoles.includes(role))) {
        throw ExpectedParseErrors.missingHierarchyRoles(requiredRoles, commandName);
    }
    return interaction.member as GuildMember;
}

/**
 * Checks if the queue_name argument is given,
 * If not, use the parent of the channel where the command was used
 * @param required
 * - If true, check if the COMMAND ARG is a valid queue category
 * - If false, check if the CURRENT channel's parent category is a valid queue category
 * @returns the complete {@link AttendingServerV2.QueueChannel} that {@link AttendingServerV2} accepts
 * */
function hasValidQueueArgument(
    interaction: ChatInputCommandInteraction,
    required = false
): QueueChannel {
    const parentCategory =
        interaction.options.getChannel('queue_name', required) ??
        (interaction.channel as GuildChannel).parent;
    // null check is done here by optional property access
    if (parentCategory?.type !== ChannelType.GuildCategory || parentCategory === null) {
        throw ExpectedParseErrors.invalidQueueCategory(parentCategory?.name);
    }
    // already checked for type, safe to cast
    const queueTextChannel = (parentCategory as CategoryChannel).children.cache.find(
        child => child.name === 'queue' && child.type === ChannelType.GuildText
    );
    if (queueTextChannel === undefined) {
        throw ExpectedParseErrors.noQueueTextChannel(parentCategory.name);
    }
    const queueChannel: QueueChannel = {
        channelObj: queueTextChannel as TextChannel,
        queueName: parentCategory.name,
        parentCategoryId: parentCategory.id
    };
    return queueChannel;
}

/**
 * Checks if the user has the Valid Email role
 * @deprecated
 * @param commandName the command used
 * @returns GuildMember object of the triggerer
 */
async function isTriggeredByUserWithValidEmail(
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    commandName: string
): Promise<GuildMember> {
    const roles = (await (interaction.member as GuildMember)?.fetch()).roles.cache.map(
        role => role.name
    );
    if (roles.includes('Verified Email')) {
        throw new CommandParseError(
            `You need to have a verified email to use \`/${commandName}\`.`
        );
    }
    return interaction.member as GuildMember;
}

/**
 * Checks if the queue channel has a parent folder
 * @returns the complete {@link AttendingServerV2.QueueChannel} that {@link AttendingServerV2} accepts
 */
function isFromQueueChannelWithParent(
    interaction: ButtonInteraction | ChatInputCommandInteraction,
    queueName: string
): QueueChannel {
    if (
        interaction.channel?.type !== ChannelType.GuildText ||
        interaction.channel.parent === null
    ) {
        throw ExpectedParseErrors.queueHasNoParent;
    }
    const queueChannel: QueueChannel = {
        channelObj: interaction.channel as TextChannel,
        queueName: queueName,
        parentCategoryId: interaction.channel.parent.id
    };
    return queueChannel;
}

/**
 * Checks if the interaction came from a valid guild member
 * @returns GuildMember object of the triggerer
 */
function isFromGuildMember(
    interaction: ButtonInteraction | ChatInputCommandInteraction
): GuildMember {
    if (interaction.member) {
        return interaction.member as GuildMember;
    }
    throw ExpectedParseErrors.notGuildInteraction;
}

export {
    isTriggeredByUserWithRoles,
    hasValidQueueArgument,
    isFromQueueChannelWithParent,
    isFromGuildMember,
    isTriggeredByUserWithValidEmail,
    isTriggeredByUserWithRolesSync
};
