/** @module ExpectedErrors */

import { Snowflake, Interaction } from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../../utils/embed-helper.js';
import { CommandParseError } from '../../utils/error-types.js';
import { Optional } from '../../utils/type-aliases.js';
import { getInteractionName } from '../../utils/util-functions.js';

/**
 * All the errors expected to happen at the parsing stage
 * - **Be careful** that some of the errors are functions and they must be called first
 * - `throw`ing a function is valid in JS, so we have to be really careful
 */
const ExpectedParseErrors = {
    accessLevelRoleDoesNotExist: (missingRoleNames: string[]) =>
        new CommandParseError(
            `The roles ${missingRoleNames.join(
                ', '
            )} does not exist on this server or have not been set up. You can use \`/settings\` -> Server Roles to configure roles.`
        ),
    missingAccessLevelRoles: (
        lowestRequiredRoleID: Snowflake,
        commandName: string
    ): CommandParseError =>
        new CommandParseError(
            `You need to have the role <@&${lowestRequiredRoleID}> or higher to use the \`${commandName}\` command.`
        ),
    missingAccessLevelRolesVariant: (
        lowestRequiredRoleName: Optional<string>,
        commandName: string,
        lowestRequiredRoleID: Snowflake
    ): CommandParseError =>
        lowestRequiredRoleName
            ? new CommandParseError(
                  `You need to have the role \`${lowestRequiredRoleName}\` or higher to use the \`${commandName}\` command.`,
                  `The ${lowestRequiredRoleName} role on this server is <@&${lowestRequiredRoleID}>`
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
        "Please use the `queue remove` command outside this category. Discord API doesn't like it :(."
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
    cannotUseBotRoleAsAccessLevelRole: new CommandParseError(
        'Bot integration roles cannot be used because no human user can have them. Please specify a different role.'
    ),
    cannotUseQueueChannelForLogging: new CommandParseError(
        '#queue channels cannot be used for logging. Please specify a different text channel.'
    ),
    notTextChannel: (channelName: string) =>
        new CommandParseError(`#${channelName} is not a text channel.`),
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
        ),
    invalidContentType: (contentType: string | null) =>
        new CommandParseError(`The content type ${contentType} is not supported.`)
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
        ),
    unexpectedFetchError: (
        interaction: Interaction,
        status: number,
        statusText: string
    ) =>
        SimpleEmbed(
            `An unexpected error happened when fetching data for your interaction \`${getInteractionName(
                interaction
            )}\`. ` +
                'Please show this message to a Bot Admin by pinging @Bot Admin (or equivalent).',
            EmbedColor.Error,
            `${status}: ${statusText}`
        )
} as const;

const ExpectedParseWarnings = {
    missingRoles: (missingRoleNames: string[]): string =>
        `This command works for you due to admin permission override` +
        `The roles ${missingRoleNames.join(', ')}` +
        ` does not exist on this server or have not been set up. You can use \`/settings\` -> Server Roles to configure roles.`,
    missingAccessLevelRoles: (
        lowestRequiredRoleID: Snowflake,
        commandName: string
    ): string =>
        `You need to have the role <@&${lowestRequiredRoleID}> or higher to use the \`${commandName}\` command.`,
    missingAccessLevelRolesVariant: (
        lowestRequiredRoleName: Optional<string>,
        commandName: string,
        lowestRequiredRoleID: Snowflake
    ): string =>
        lowestRequiredRoleName
            ? `You need to have the role \`${lowestRequiredRoleName}\` or higher to use the \`${commandName}\` command. ` +
              `The ${lowestRequiredRoleName} role on this server is <@&${lowestRequiredRoleID}>`
            : `Some access level roles have not been set up on this server. Please ask the server owner to use /set_roles or the settings menu to set it up.`,
    noQueuesInServer: (): string =>
        `This command doesn't have any effect since server doesn't have any queues. `
} as const;

export { ExpectedParseErrors, UnexpectedParseErrors, ExpectedParseWarnings };
