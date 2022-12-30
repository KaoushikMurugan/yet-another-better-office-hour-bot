import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    GuildMember,
    Interaction,
    ModalSubmitInteraction,
    PermissionsBitField,
    SelectMenuInteraction
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
import { attendingServers } from '../global-states.js';
import { GuildId } from '../utils/type-aliases.js';
import { ExpectedParseErrors } from './interaction-constants/expected-interaction-errors.js';
import { FrozenServer } from '../extensions/extension-utils.js';
import { HierarchyRoles } from '../models/hierarchy-roles.js';
import { CommandParseError } from '../utils/error-types.js';
import { decompressComponentId } from '../utils/component-id-factory.js';

/**
 * Checks if the interaction is associated with a correctly initialized AttendingServerV2
 * - Extensions that wish to do additional checks can use this as a base
 * @returns the {@link AttendingServerV2} object
 */
function isServerInteraction(
    idOrInteraction: Interaction<'cached'> | GuildId
): AttendingServerV2 {
    if (typeof idOrInteraction === 'string') {
        const server = attendingServers.get(idOrInteraction);
        if (!server) {
            throw ExpectedParseErrors.nonServerInterction(idOrInteraction);
        }
        return server;
    } else {
        const server = attendingServers.get(idOrInteraction.guild.id);
        if (!server) {
            throw ExpectedParseErrors.nonServerInterction(idOrInteraction.guild.name);
        }
        return server;
    }
}

/**
 * Checks if the command came from a dm with correctly initialized YABOB
 * - Extensions that wish to do additional checks can use this as a base
 * @returns the {@link AttendingServerV2} object
 */
function isValidDMInteraction(
    interaction: ButtonInteraction | ModalSubmitInteraction | SelectMenuInteraction
): AttendingServerV2 {
    const [type, , serverId] = decompressComponentId(interaction.customId);
    if (type !== 'dm') {
        throw ExpectedParseErrors.nonYabobInteraction;
    }
    const server = attendingServers.get(serverId);
    if (!server) {
        throw ExpectedParseErrors.nonServerInterction(serverId);
    }
    return server;
}

function isFromQueueChannelWithParent(
    interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>
): QueueChannel {
    if (!isTextChannel(interaction.channel) || interaction.channel.parent === null) {
        throw ExpectedParseErrors.queueHasNoParent;
    }
    const queueChannel: QueueChannel = {
        channelObj: interaction.channel,
        queueName: interaction.channel.parent.name,
        parentCategoryId: interaction.channel.parent.id
    };
    return queueChannel;
}

/**
 * Checks if the triggerer has the any role above or equal to the `lowestRequiredRole`.
 * Based on Role IDs instead of Role Names
 * @param server the server where the interaction was called
 * @param member the member who triggered the interaction
 * @param commandName the command used
 * @param lowestRequiredRole the minimum role required to use the command
 * @returns GuildMember object of the triggerer
 */
function isTriggeredByMemberWithRoles(
    server: FrozenServer,
    member: GuildMember,
    commandName: string,
    lowestRequiredRole: keyof HierarchyRoles
): GuildMember {
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return member;
    }
    const memberRoleIds = member.roles.cache.map(role => role.id);
    for (const hierarchyRole of server.sortedHierarchyRoles) {
        // if memberRoleIds.some returns true, then exit early
        // if the lowestRequiredRole is hit first, then break and throw
        if (memberRoleIds.some(memberRoleId => memberRoleId === hierarchyRole.id)) {
            return member;
        }
        if (hierarchyRole.key === lowestRequiredRole) {
            break;
        }
    }
    // the for loop should directly return if the lowestRequiredRole is satisfied
    // otherwise if the loop breaks then we must throw
    throw ExpectedParseErrors.missingHierarchyRolesNameVariant(
        server.guild.roles.cache.get(server.hierarchyRoleIds[lowestRequiredRole])?.name,
        commandName
    );
}

/**
 * Checks if the queue_name argument is given,
 * If not, use the parent of the channel where the command was used
 * @param required
 * - If true, check if the COMMAND ARG is a valid queue category
 * - If false, check if the CURRENT channel's parent category is a valid queue category
 * @returns the complete QueueChannel that {@link AttendingServerV2} accepts
 * */
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
 * Checks if the user has the Valid Email role
 * @deprecated
 * @param commandName the command used
 * @returns GuildMember object of the triggerer
 */
function isTriggeredByUserWithValidEmail(
    interaction: Interaction<'cached'>,
    commandName: string
): GuildMember {
    if (!interaction.member.roles.cache.some(role => role.name === 'Verified Email')) {
        throw new CommandParseError(
            `You need to have a verified email to use \`/${commandName}\`.`
        );
    }
    return interaction.member;
}

export {
    isServerInteraction,
    isFromQueueChannelWithParent,
    isValidDMInteraction,
    isTriggeredByMemberWithRoles,
    hasValidQueueArgument,
    isTriggeredByUserWithValidEmail
};