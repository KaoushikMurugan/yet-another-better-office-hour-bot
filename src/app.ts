import {
    getHandler,
    interactionExtensions
} from './interaction-handling/interaction-entry-point.js';
import { Guild, Interaction, Events } from 'discord.js';
import { AttendingServerV2 } from './attending-server/base-attending-server.js';
import { magenta, red, yellow } from './utils/command-line-colors.js';
import { EmbedColor, SimpleEmbed } from './utils/embed-helper.js';
import { client, LOGGER } from './global-states.js';
import { environment } from './environment/environment-manager.js';
import { updatePresence } from './utils/discord-presence.js';
import {
    centered,
    printTitleString,
    isLeaveVC,
    isJoinVC
} from './utils/util-functions.js';
import { serverSettingsMainMenuOptions } from './attending-server/server-settings-menus.js';
import { postSlashCommands } from './interaction-handling/interaction-constants/builtin-slash-commands.js';
import { UnexpectedParseErrors } from './interaction-handling/interaction-constants/expected-interaction-errors.js';
import { adminCommandHelpMessages } from '../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../help-channel-messages/StudentCommands.js';

/**
 * After login startup sequence
 */
client.on(Events.ClientReady, async () => {
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
    setupResults.forEach(
        result => result.status === 'rejected' && LOGGER.error(`${result.reason}`)
    );
    if (setupResults.filter(result => result.status === 'fulfilled').length === 0) {
        LOGGER.error('All server setups failed. Aborting.');
        process.exit(1);
    }
    LOGGER.info(
        `✅ Ready to go! (${AttendingServerV2.activeServersCount} servers created) ✅`
    );
    LOGGER.info(centered('-------- Begin Server Logs --------'));
    updatePresence();
    setInterval(updatePresence, 1000 * 60 * 30);
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
    const server = AttendingServerV2.safeGet(guild.id);
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
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    getHandler(interaction)(interaction).catch((err: Error) => {
        LOGGER.error('Uncaught Error:', err);
        interaction.user
            .send(UnexpectedParseErrors.unexpectedError(interaction, err))
            .catch(LOGGER.error);
    });
});

/**
 * Gives the student role to new members if auto_give_student_role is set to true
 */
client.on(Events.GuildMemberAdd, async member => {
    const server = AttendingServerV2.safeGet(member.guild.id);
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
            LOGGER.error('Failed to add student role', err);
            member
                .send(
                    SimpleEmbed(
                        `I can't give you the ${studentRole.name} at the moment. Please contact the server admin to manually give you ${studentRole.name}.`
                    )
                )
                .catch(err => LOGGER.error('Failed to send member Dm', err));
        });
    }
});

/**
 * Used for inviting YABOB to a server with existing roles
 * Once YABOB has the highest role, start the initialization call
 */
client.on(Events.GuildRoleUpdate, async role => {
    // if id exists, then we ignore
    if (AttendingServerV2.safeGet(role.guild.id)) {
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
 * Track when members join or leave a voice channel
 */
client.on(Events.VoiceStateUpdate, async (oldVoiceState, newVoiceState) => {
    const server = AttendingServerV2.safeGet(oldVoiceState.guild.id);
    if (newVoiceState.member === null || !server) {
        // don't throw error here, just ignore it, otherwise it's uncaught
        return;
    }
    if (isLeaveVC(oldVoiceState, newVoiceState)) {
        await server.onMemberLeaveVC(newVoiceState.member, oldVoiceState);
    } else if (isJoinVC(oldVoiceState, newVoiceState)) {
        await server.onMemberJoinVC(newVoiceState.member, newVoiceState);
    }
});

/**
 * Emit the on role delete event
 */
client.on(Events.GuildRoleDelete, async role => {
    await AttendingServerV2.safeGet(role.guild.id)?.onRoleDelete(role);
});

client.on(Events.GuildMemberRemove, async member => {
    const server = AttendingServerV2.safeGet(member.guild.id);
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
    console.warn(magenta('Uncaught DiscordJS Warning: '), warning);
});

/**
 * Neatly separate server log and error stack trace
 */
process.on('exit', () => {
    LOGGER.info(centered('-------- End of Server Log --------'));
    LOGGER.info(`${centered('-------- Begin Error Stack Trace --------')}\n`);
});

/**
 * YABOB Initialization sequence
 * @param guild server to join
 * @returns AttendingServerV2 if successfully initialized
 * @throws ServerError if the AttendingServerV2.create failed
 */
async function joinGuild(guild: Guild): Promise<AttendingServerV2> {
    LOGGER.info(`Joining guild: ${yellow(guild.name)}`);
    const externalCommandData = environment.disableExtensions
        ? []
        : interactionExtensions.flatMap(ext => ext.slashCommandData);
    await postSlashCommands(guild, externalCommandData);
    await guild.commands.fetch(); // populate cache
    // Extensions for server & queue are loaded inside the create method
    const server = await AttendingServerV2.create(guild);
    return server;
}

/**
 * Combines all the extension help messages and settings menu options
 * - if we have more static data in interaction level extensions, collect them here
 * - extensions only need to specify the corresponding properties
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
}
