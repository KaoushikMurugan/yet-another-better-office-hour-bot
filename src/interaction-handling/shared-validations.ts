import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    GuildMember,
    Interaction,
    ModalSubmitInteraction,
    PermissionsBitField,
    StringSelectMenuInteraction
} from 'discord.js';
import {
    AttendingServerV2,
    QueueChannel
} from '../attending-server/base-attending-server.js';
import {
    isCategoryChannel,
    isQueueTextChannel,
    isTextChannel
} from '../utils/util-functions.js';
import { ExpectedParseErrors } from './interaction-constants/expected-interaction-errors.js';
import { FrozenServer } from '../extensions/extension-utils.js';
import { AccessLevelRole } from '../models/access-level-roles.js';
import { decompressComponentId } from '../utils/component-id-factory.js';
import { yellow } from '../utils/command-line-colors.js';
import { CategoryChannelId } from '../utils/type-aliases.js';
import { logger } from '../global-states.js';

/**
 * Checks if the command came from a dm with correctly initialized YABOB
 * - Extensions that wish to do additional checks can use this as a base
 * @returns the {@link AttendingServerV2} object
 */
function isValidDMInteraction(
    interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction
): AttendingServerV2 {
    const [type, , serverId] = decompressComponentId(interaction.customId);
    if (type !== 'dm') {
        throw ExpectedParseErrors.nonYabobInteraction;
    }
    const server = AttendingServerV2.get(serverId);
    return server;
}
/**
 * Checks if the `interaction` is from a queue channel
 * @param interaction
 * @returns the {@link QueueChannel} object of the queue channel
 */
function isFromQueueChannelWithParent(interaction: Interaction<'cached'>): QueueChannel {
    if (!isTextChannel(interaction.channel) || interaction.channel.parent === null) {
        throw ExpectedParseErrors.queueHasNoParent;
    }
    const server = AttendingServerV2.get(interaction.guildId);
    const queueChannel = server.getQueueChannelById(interaction.channel.parent.id);
    if (!queueChannel) {
        throw ExpectedParseErrors.unrecognizedQueue(interaction.channel.parent.name);
    }
    // TODO: temporary solution, move this somewhere else
    logger.info(` - In Queue: ${yellow(queueChannel.queueName)}`);
    return queueChannel;
}

/**
 * Variant of {@link isFromQueueChannelWithParent} that returns only the parentCategoryId
 * @param interaction
 * @returns parentCategoryId
 */
function isFromQueueChannelWithParentIdOnly(
    interaction: Interaction<'cached'>
): CategoryChannelId {
    if (!isTextChannel(interaction.channel) || interaction.channel.parent === null) {
        throw ExpectedParseErrors.queueHasNoParent;
    }
    const server = AttendingServerV2.get(interaction.guildId);
    if (!server.getQueueChannelById(interaction.channel.parent.id)) {
        throw ExpectedParseErrors.unrecognizedQueue(interaction.channel.parent.name);
    }
    return interaction.channel.parent.id;
}

/**
 * Checks if the trigger-er has the any role above or equal to the `lowestRequiredRole`.
 * Based on Role IDs instead of Role Names
 * @param server the server where the interaction was called
 * @param member the member who triggered the interaction
 * @param commandName the command used
 * @param lowestRequiredRole the minimum role required to use the command
 * @returns GuildMember object of the trigger-er
 */
function isTriggeredByMemberWithRoles(
    server: FrozenServer,
    member: GuildMember,
    commandName: string,
    lowestRequiredRole: AccessLevelRole
): GuildMember {
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return member;
    }
    const memberRoleIds = member.roles.cache.map(role => role.id);
    for (const role of server.sortedAccessLevelRoles) {
        // if memberRoleIds.some returns true, then exit early
        // if the lowestRequiredRole is hit first, then break and throw
        if (memberRoleIds.some(memberRoleId => memberRoleId === role.id)) {
            return member;
        }
        if (role.key === lowestRequiredRole) {
            break;
        }
    }
    // the for loop should directly return if the lowestRequiredRole is satisfied
    // otherwise if the loop breaks then we must throw
    throw ExpectedParseErrors.missingAccessLevelRolesVariant(
        server.guild.roles.cache.get(server.accessLevelRoleIds[lowestRequiredRole])?.name,
        commandName,
        server.accessLevelRoleIds[lowestRequiredRole]
    );
}

/**
 * Checks if the queue_name argument is given,
 * If not, use the parent of the channel where the command was used
 * @param required
 * - If true, check if the **command argument** is a valid queue category
 * - If false, check if the **current channel**'s parent category is a valid queue category
 * @returns the complete QueueChannel that {@link AttendingServerV2} accepts
 */
function hasValidQueueArgument(
    interaction: ChatInputCommandInteraction<'cached'>,
    required = false
): QueueChannel {
    if (!interaction.channel || !('parent' in interaction.channel)) {
        throw ExpectedParseErrors.invalidQueueCategory();
    }
    const parentCategory =
        interaction.options.getChannel('queue_name', required) ??
        interaction.channel.parent;
    if (!isCategoryChannel(parentCategory)) {
        throw ExpectedParseErrors.invalidQueueCategory(parentCategory?.name);
    }
    const queueTextChannel = parentCategory.children.cache.find(isQueueTextChannel);
    if (queueTextChannel === undefined) {
        throw ExpectedParseErrors.noQueueTextChannel(parentCategory.name);
    }
    const queueChannel: QueueChannel = {
        channelObj: queueTextChannel,
        queueName: parentCategory.name,
        parentCategoryId: parentCategory.id
    };
    return queueChannel;
}

/**
 * Variant of {@link hasValidQueueArgument} that returns only the category channel id
 * @param interaction
 * @param required
 * @returns the parentCategoryId if the queue channel is valid
 */
function hasValidQueueArgumentIdOnly(
    interaction: ChatInputCommandInteraction<'cached'>,
    required = false
): CategoryChannelId {
    if (!interaction.channel || !('parent' in interaction.channel)) {
        throw ExpectedParseErrors.invalidQueueCategory();
    }
    const parentCategory =
        interaction.options.getChannel('queue_name', required) ??
        interaction.channel.parent;
    if (!isCategoryChannel(parentCategory)) {
        throw ExpectedParseErrors.invalidQueueCategory(parentCategory?.name);
    }
    const queueTextChannel = parentCategory.children.cache.find(isQueueTextChannel);
    if (queueTextChannel === undefined) {
        throw ExpectedParseErrors.noQueueTextChannel(parentCategory.name);
    }
    return parentCategory.id;
}

/**
 * Checks if there are enough channel count for new channels to be created
 * @param interaction
 * @param numNewCategories number of new categories needed to create
 * @param numNewChannels number of new channels needed to create
 * - if multiple types of channels are being created, add them together first before calling this function
 * @returns true, otherwise throws error
 */
async function channelsAreUnderLimit(
    interaction: Interaction<'cached'>,
    numNewCategories: number,
    numNewChannels: number
): Promise<true> {
    const numCategoryChannels = (await interaction.guild.channels.fetch()).filter(
        isCategoryChannel
    ).size;
    // max number of category channels is 50
    // max number of guild channels is 500
    if (
        numCategoryChannels >= 50 - numNewCategories ||
        interaction.guild.channels.cache.size >= 500 - numNewChannels
    ) {
        throw ExpectedParseErrors.tooManyChannels;
    }
    return true;
}

export {
    isFromQueueChannelWithParent,
    isFromQueueChannelWithParentIdOnly,
    isValidDMInteraction,
    isTriggeredByMemberWithRoles,
    hasValidQueueArgument,
    hasValidQueueArgumentIdOnly,
    channelsAreUnderLimit
};
