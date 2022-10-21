/** @module ExpectedErrors */

import { CommandParseError } from '../utils/error-types';
import { Optional } from '../utils/type-aliases';

const ExpectedParseErrors = {
    missingHierarchyRoles: (
        requiredRoles: string[],
        commandName: string
    ): CommandParseError =>
        new CommandParseError(
            `You need to have: [${requiredRoles.join(
                ' or '
            )}] to use \`/${commandName}\`.`
        ),
    invalidQueueCategory: (categoryName: Optional<string>): CommandParseError =>
        categoryName === undefined
            ? new CommandParseError(
                  `This category has no name, and it's not a valid queue category.`
              )
            : new CommandParseError(`\`${categoryName}\` is not a valid queue category.`),
    noQueueTextChannel: (categoryName: Optional<string>): CommandParseError =>
        new CommandParseError(
            `This category does not have a \`#queue\` text channel.\n` +
                `If you are an admin, you can use \`/queue add ${categoryName}\` ` +
                `to generate one.`
        ),
    notGuildInteraction: new CommandParseError('Sorry, I only accept server'),
    queueHasNoParent: new CommandParseError(
        'Invalid Button or Command. Make sure this channel has a parent category.'
    ),
    removeInsideQueue: new CommandParseError(
        `Please use the remove command in another channel.` +
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
            `You can use \`/queue add <name>\` to create one`
    ),
    nonServerInterction: (guildName: Optional<string>) =>
        guildName === undefined
            ? new CommandParseError(
                  'I can only accept server based interactions.' +
                      ' Please use the interaction inside a server'
              )
            : new CommandParseError(
                  'I can only accept interactions in corrected initialized servers. ' +
                      `Are you sure ${guildName} has a initialized YABOB?`
              )
} as const;

export { ExpectedParseErrors };
