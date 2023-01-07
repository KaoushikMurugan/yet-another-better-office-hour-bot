/** @module ExpectedErrors */

import { Snowflake, Interaction } from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../../utils/embed-helper.js';
import { CommandParseError } from '../../utils/error-types.js';
import { Optional } from '../../utils/type-aliases.js';
import { getInteractionName } from '../../utils/util-functions.js';
import { HierarchyRoles, hierarchyRoleConfigs } from '../../models/hierarchy-roles.js';

const ExpectedParseErrors = {
    hierarchyRoleDoesNotExist: (
        missingRoleNames: typeof hierarchyRoleConfigs[keyof HierarchyRoles]['displayName'][]
    ) =>
        new CommandParseError(
            `The roles ${missingRoleNames.join(
                ', '
            )} does not exist on this server or have not been set up. You can use \`/settings\` -> Server Roles to configure roles.`
        ),
    missingHierarchyRoles: (
        lowestRequiredRoleID: Snowflake,
        commandName: string
    ): CommandParseError =>
        new CommandParseError(
            `You need to have the role <@&${lowestRequiredRoleID}> or higher to use the \`${commandName}\` command.`
        ),
    missingHierarchyRolesNameVariant: (
        lowestRequiredRoleName: Optional<string>,
        commandName: string
    ): CommandParseError =>
        lowestRequiredRoleName
            ? new CommandParseError(
                  `You need to have the role \`${lowestRequiredRoleName}\` or higher to use the \`${commandName}\` command. You can ask the owner of this server to see which role is ${lowestRequiredRoleName}.`
              )
            : new CommandParseError(
                  `Some access level roles have not been set up on this server. Please ask the server owner to use /set_roles or the settings menu to set it up.`
              ),
    invalidQueueCategory: (categoryName?: string) =>
        categoryName === undefined
            ? new CommandParseError(
                  "This category has no name, and it's not a valid queue category.\nPlease use this interaction inside a category that has the #queue channel."
              )
            : new CommandParseError(
                  `\`${categoryName}\` is not a valid queue category.\nPlease use this interaction inside a category that has the #queue channel.`
              ),
    unrecognizedQueue: (categoryName?: string) =>
        new CommandParseError(
            `YABOB doesn't recognize a queue named \`${categoryName}\`.`
        ),
    noQueueTextChannel: (categoryName: Optional<string>) =>
        new CommandParseError(
            `This category does not have a \`#queue\` text channel.\n` +
                `If you are an admin, you can use \`/queue add ${categoryName}\` ` +
                `to generate one.`
        ),
    notGuildInteraction: new CommandParseError(
        'Sorry, I can only accept server server interactions right now.'
    ),
    queueHasNoParent: new CommandParseError(
        'Invalid Button or Command. Make sure this #queue channel has a parent category.'
    ),
    removeInsideQueue: new CommandParseError(
        `Please use the remove command outside this category.` +
            ` Otherwise Discord API will reject.`
    ),
    noPermission: {
        clear: (queueName: string) =>
            new CommandParseError(
                `You don't have permission to clear '${queueName}'. ` +
                    `You can only clear the queues that you have a role of.`
            )
    },
    serverHasNoQueue: new CommandParseError(
        `This server doesn't seem to have any queues. ` +
            `You can use \`/queue add <name>\` to create one.`
    ),
    nonServerInteraction: (guildName?: string) =>
        guildName === undefined
            ? new CommandParseError(
                  'I can only accept server based interactions.' +
                      ' Please use the interaction inside a server'
              )
            : new CommandParseError(
                  'I can only accept interactions in correctly initialized servers. ' +
                      `Are you sure ${guildName} has a initialized YABOB?`
              ),
    nonYabobInteraction: new CommandParseError(
        'This interaction is not a YABOB interaction.'
    ),
    badAutoClearValues: new CommandParseError(
        'Please enter valid integers for both `hours` and `minutes`.'
    ),
    messageIsTooLong: new CommandParseError(
        'Sorry, Discord only allows messages shorter than 4096 characters. Please revise your message to be shorter.'
    ),
    tooManyChannels: new CommandParseError(
        'Sorry, you have too many categories and channels on this server. YABOB cannot create another category for this new queue.'
    ),
    cannotUseBotRoleAsHierarchyRole: new CommandParseError(
        'Bot integration roles cannot be used because no human user can have them. Please specify a different role.'
    ),
    invalidChannelName: (channelName: string) =>
        new CommandParseError(
            `${channelName} is an invalid channel name. Please use a name that is between 1 and 100 characters (inclusive) long and \
only contains alphanumeric characters, hyphens, and underscores.`
        ),
    invalidCategoryName: (categoryName: string) =>
        new CommandParseError(
            `${categoryName} is an invalid category name. Please use a name that is between 1 and 100 characters (inclusive) long and \
includes at least one non-whitespace character.`
        ),
    nonExistentTextChannel: (channelId: string | undefined) =>
        new CommandParseError(
            `The channel with id ${channelId} does not exist on this server.`
        )
} as const;

const UnexpectedParseErrors = {
    unableToReply: (interaction: Interaction<'cached'>) =>
        SimpleEmbed(
            `Sorry, YABOB finished your interaction \`${getInteractionName(
                interaction
            )}\` but couldn't reply back to you.`,
            EmbedColor.Error
        ),
    unexpectedError: (interaction: Interaction, err: Error) =>
        SimpleEmbed(
            `An unexpected error happened when processing your interaction \`${getInteractionName(
                interaction
            )}\`. ` +
                'Please show this message to a Bot Admin by pinging @Bot Admin (or equivalent).',
            EmbedColor.Error,
            `${err.name}, ${err.message}`
        )
} as const;

export { ExpectedParseErrors, UnexpectedParseErrors };
