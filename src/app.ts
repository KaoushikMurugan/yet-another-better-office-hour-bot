import {
    getHandler,
    interactionExtensions
} from './interaction-handling/interaction-entry-point.js';
import { Guild, Events, ChannelType } from 'discord.js';
import { AttendingServer } from './attending-server/base-attending-server.js';
import { black, green, red, yellow } from './utils/command-line-colors.js';
import { EmbedColor, SimpleEmbed } from './utils/embed-helper.js';
import { client, LOGGER } from './global-states.js';
import { environment } from './environment/environment-manager.js';
import { updatePresence } from './utils/discord-presence.js';
import {
    printTitleString,
    isLeaveVBC,
    isJoinVBC,
    isCategoryChannel
} from './utils/util-functions.js';
import { serverSettingsMainMenuOptions } from './attending-server/server-settings-menus.js';
import { postGuildSlashCommands, postGlobalSlashCommands } from './interaction-handling/interaction-constants/builtin-slash-commands.js';
import { UnexpectedParseErrors } from './interaction-handling/interaction-constants/expected-interaction-errors.js';
import { adminCommandHelpMessages } from './help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from './help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from './help-channel-messages/StudentCommands.js';
import { quickStartPages } from './attending-server/quick-start-pages.js';

/**
 * After login startup sequence
 */
client.once(Events.ClientReady, async () => {
    printTitleString();
    // do the global initialization checks and collect static data
    await Promise.all(interactionExtensions.map(ext => ext.initializationCheck()));
    collectInteractionExtensionStaticData();
    // completeGuilds is all the servers this YABOB instance has joined
    const completeGuilds = await Promise.all(
        client.guilds.cache.map(guild => guild.fetch())
    );
    // create all the AttendingServerV2 objects
    const setupResults = await Promise.allSettled(completeGuilds.map(joinGuild));
    setupResults.forEach(result => {
        if (result.status === 'rejected') {
            LOGGER.error(`${result.reason}`);
        }
    });
    if (setupResults.filter(result => result.status === 'fulfilled').length === 0) {
        LOGGER.fatal('All server setups failed. Aborting.');
        process.exit(1);
    }
    LOGGER.info(
        black(
            green(
                `✅ Ready to go! (${AttendingServer.activeServersCount} servers created) ✅`,
                'Bg'
            )
        )
    );
    LOGGER.info('-------- Begin Server Logs --------');
    updatePresence();
    setInterval(updatePresence, 1000 * 60 * 30);
    if(environment.env === 'production') {
        const externalCommandData = environment.disableExtensions
            ? []
            : interactionExtensions.flatMap(ext => ext.slashCommandData);
        await postGlobalSlashCommands(externalCommandData);
    }
    else
    {
        // remove global commands during development
        await client.application.commands.set([]);
    }
});

/**
 * Server joining procedure
 */
client.on(Events.GuildCreate, async guild => {
    LOGGER.info(`Got invited to: ${guild.name}`);
    await joinGuild(guild).catch(err => {
        LOGGER.error(err);
        LOGGER.error(`${red('Please give me the highest role in:')} '${guild.name}'.`);
    });
});

/**
 * Server exit procedure
 * - Clears all the periodic updates
 * - Deletes server from server map
 */
client.on(Events.GuildDelete, async guild => {
    const server = AttendingServer.safeGet(guild.id);
    if (!server) {
        return;
    }
    await server.gracefulDelete();
    LOGGER.info(`Leaving ${guild.name}. Backups will be saved by the extensions.`);
});

/**
 * Handles all interactions
 * - Slash commands
 * - Button presses
 * - Modal submissions
 */
client.on(Events.InteractionCreate, async interaction => {
    getHandler(interaction)(interaction).catch((err: Error) => {
        LOGGER.fatal(err, 'Uncaught Error');
        interaction.user
            .send(UnexpectedParseErrors.unexpectedError(interaction, err))
            .catch(LOGGER.error);
    });
});

/**
 * Gives the student role to new members if auto_give_student_role is set to true
 */
client.on(Events.GuildMemberAdd, async member => {
    const server = AttendingServer.safeGet(member.guild.id);
    if (!server || !server.autoGiveStudentRole) {
        return;
    }
    const studentRole = server.guild.roles.cache.find(
        role => role.id === server.studentRoleID
    );
    if (
        studentRole !== undefined &&
        !member.user.bot &&
        studentRole.id !== server.guild.roles.everyone.id
    ) {
        member.roles.add(studentRole).catch(err => {
            LOGGER.error(err, 'Failed to add student role');
            member
                .send(
                    SimpleEmbed(
                        `I can't give you the ${studentRole.name} at the moment. Please contact the server admin to manually give you ${studentRole.name}.`
                    )
                )
                .catch(e => LOGGER.error(e, 'Failed to send member Dm'));
        });
    }
});

/**
 * If a queue is renamed manually, it renames the queue name for queue embeds, roles, and calendar extension
 */
client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (
        oldChannel.type === ChannelType.GuildCategory &&
        newChannel.type === ChannelType.GuildCategory &&
        oldChannel.name !== newChannel.name
    ) {
        await AttendingServer.safeGet(oldChannel.guild.id)?.updateQueueName(
            oldChannel,
            newChannel
        );
    }
});

/**
 * Used for inviting YABOB to a server with existing roles
 * Once YABOB has the highest role, start the initialization call
 */
client.on(Events.GuildRoleUpdate, async role => {
    // if id exists, then we ignore
    if (AttendingServer.safeGet(role.guild.id)) {
        return;
    }
    if (
        role.name === client.user.username &&
        role.guild.roles.highest.name === client.user.username
    ) {
        LOGGER.info('Got the highest Role! Starting server initialization');
        const owner = await role.guild.fetchOwner();
        await Promise.all([
            joinGuild(role.guild),
            owner.send(
                SimpleEmbed(
                    `Got the highest Role! Starting server initialization for ${role.guild.name}`,
                    EmbedColor.Success
                )
            )
        ]);
    }
});

/**
 * Track if a channel has been deleted
 * If a channel has been manually deleted, delete the queue
 */
client.on(Events.ChannelDelete, async channel => {
    if (channel.isDMBased() || !isCategoryChannel(channel)) {
        return;
    }
    const server = AttendingServer.safeGet(channel.guild.id);
    if (server && server.categoryChannelIDs.includes(channel.id)) {
        // if the category channels haven't been deleted already with the '/queue remove' command
        // delete role
        await server.guild.roles.fetch();
        await server.guild.roles.cache.find(role => role.name === channel.name)?.delete();
        // delete queue
        await server.deleteQueueById(channel.id);
    }
});

/**
 * Track when members join or leave a voice channel
 */
client.on(Events.VoiceStateUpdate, async (oldVoiceState, newVoiceState) => {
    const server = AttendingServer.safeGet(oldVoiceState.guild.id);
    if (newVoiceState.member === null || !server) {
        // don't throw error here, just ignore it, otherwise it's uncaught
        return;
    }
    if (isLeaveVBC(oldVoiceState, newVoiceState)) {
        await server.onMemberLeaveVBC(newVoiceState.member, oldVoiceState);
    } else if (isJoinVBC(oldVoiceState, newVoiceState)) {
        await server.onMemberJoinVBC(newVoiceState.member, newVoiceState);
    }
});

/**
 * Emit the on role delete event
 */
client.on(Events.GuildRoleDelete, async role => {
    await AttendingServer.safeGet(role.guild.id)?.onRoleDelete(role);
});

client.on(Events.GuildMemberRemove, async member => {
    const server = AttendingServer.safeGet(member.guild.id);
    if (server !== undefined) {
        await Promise.allSettled(
            server.queues
                .filter(queue =>
                    queue.students.find(student => student.member.id === member.id)
                )
                .map(queue => queue.removeStudent(member))
        );
    }
});

/**
 * Discord.js warning handling
 */
client.on(Events.Warn, warning => {
    LOGGER.warn('Uncaught DiscordJS Warning: ', warning);
});

/**
 * Neatly separate server log and error stack trace
 */
process.on('exit', () => {
    LOGGER.info('-------- End of Server Log --------');
    LOGGER.info('-------- Begin Error Stack Trace --------\n');
});

/**
 * YABOB Initialization sequence
 * @param guild server to join
 * @returns AttendingServerV2 if successfully initialized
 * @throws ServerError if the AttendingServerV2.create failed
 */
async function joinGuild(guild: Guild): Promise<AttendingServer> {
    LOGGER.info(`Joining guild: ${yellow(guild.name)}`);
    if(environment.env === 'development') {
        const externalCommandData = environment.disableExtensions
            ? []
            : interactionExtensions.flatMap(ext => ext.slashCommandData);
        await postGuildSlashCommands(guild, externalCommandData);
    }
    else { // production
        // clear all guild commands
        await guild.commands.set([]);
    }
    await guild.commands.fetch(); // populate cache
    // Extensions for server & queue are loaded inside the create method
    const server = await AttendingServer.create(guild);
    return server;
}

/**
 * Combines all the extension help messages and settings menu options
 * - if we have more static data in interaction level extensions, collect them here
 * - extensions only need to specify the corresponding properties
 * - This should be called exactly ONCE in client.on('ready')
 */
function collectInteractionExtensionStaticData(): void {
    const documentationLink = {
        nameValuePair: {
            name: 'Documentation Link',
            value: 'documentation-link'
        },
        useInHelpChannel: true,
        useInHelpCommand: false,
        message: {
            embeds: [
                {
                    color: EmbedColor.Neutral,
                    title: 'Documentation Link',
                    url: 'https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Built-in-Commands'
                }
            ]
        }
    };
    adminCommandHelpMessages.push(
        ...interactionExtensions.flatMap(ext => ext.helpMessages.botAdmin),
        documentationLink
    );
    helperCommandHelpMessages.push(
        ...interactionExtensions.flatMap(ext => ext.helpMessages.staff),
        documentationLink
    );
    studentCommandHelpMessages.push(
        ...interactionExtensions.flatMap(ext => ext.helpMessages.student),
        documentationLink
    );
    serverSettingsMainMenuOptions.push(
        ...interactionExtensions.flatMap(ext => ext.settingsMainMenuOptions)
    );
    quickStartPages.splice(
        quickStartPages.length - 1, // insert before the last page
        0, // don't delete any elements
        ...interactionExtensions.flatMap(ext => ext.quickStartPages)
    );
}
