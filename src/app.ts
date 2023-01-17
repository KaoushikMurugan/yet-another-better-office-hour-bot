import {
    getHandler,
    interactionExtensions
} from './interaction-handling/interaction-entry-point.js';
import { Guild, Interaction, Events } from 'discord.js';
import { AttendingServerV2 } from './attending-server/base-attending-server.js';
import { magenta, cyan, green, red, yellow } from './utils/command-line-colors.js';
import { EmbedColor, SimpleEmbed } from './utils/embed-helper.js';
import { client } from './global-states.js';
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

const failedInteractions: Array<{ username: string; interaction: Interaction }> = [];

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
        result => result.status === 'rejected' && console.log(`${result.reason}`)
    );
    if (setupResults.filter(result => result.status === 'fulfilled').length === 0) {
        console.error('All server setups failed. Aborting.');
        process.exit(1);
    }
    console.log(
        `\n${green(
            `✅ Ready to go! (${AttendingServerV2.activeServersCount} servers created) ✅`
        )}\n`
    );
    console.log(`${centered('-------- Begin Server Logs --------')}\n`);
    updatePresence();
    setInterval(updatePresence, 1000 * 60 * 30);
});

/**
 * Server joining procedure
 */
client.on(Events.GuildCreate, async guild => {
    console.log(`${magenta('Got invited to:')} '${guild.name}'!`);
    await joinGuild(guild).catch(err => {
        console.error(err);
        console.error(`${red('Please give me the highest role in:')} '${guild.name}'.`);
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
    console.log(red(`Leaving ${guild.name}. Backups will be saved by the extensions.`));
});

/**
 * Handles all interactions
 * - Slash commands
 * - Button presses
 * - Modal submissions
 */
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    getHandler(interaction)(interaction).catch((err: Error) => {
        console.error(err);
        interaction.user
            .send(UnexpectedParseErrors.unexpectedError(interaction, err))
            .catch(() =>
                failedInteractions.push({
                    username: interaction.user.username,
                    interaction: interaction
                })
            );
    });
});

/**
 * Gives the Student role to new members
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
            console.error('Failed to add student role', err);
            member
                .send(
                    SimpleEmbed(
                        `I can't give you the ${studentRole.name} at the moment. Please contact the server admin to manually give you ${studentRole.name}.`
                    )
                )
                .catch(err => console.error('Failed to send member Dm', err));
        });
    }
});

/**
 * Used for inviting YABOB to a server with existing roles
 * Once YABOB has the highest role, start the initialization call
 */
client.on(Events.GuildRoleUpdate, async role => {
    // if id exists
    if (AttendingServerV2.safeGet(role.guild.id)) {
        return;
    }
    if (
        role.name === client.user.username &&
        role.guild.roles.highest.name === client.user.username
    ) {
        console.log(cyan('Got the highest Role! Starting server initialization'));
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
    console.log(centered('-------- End of Server Log --------'));
    console.log(`${centered('-------- Begin Error Stack Trace --------')}\n`);
    console.log(`These ${failedInteractions.length} interactions failed:`);
    console.log(failedInteractions);
});

/**
 * YABOB Initialization sequence
 * @param guild server to join
 * @returns AttendingServerV2 if successfully initialized
 * @throws ServerError if the AttendingServerV2.create failed
 */
async function joinGuild(guild: Guild): Promise<AttendingServerV2> {
    console.log(`Joining guild: ${yellow(guild.name)}`);
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
    adminCommandHelpMessages.push(
        ...interactionExtensions.flatMap(ext => ext.helpMessages.botAdmin)
    );
    helperCommandHelpMessages.push(
        ...interactionExtensions.flatMap(ext => ext.helpMessages.staff)
    );
    studentCommandHelpMessages.push(
        ...interactionExtensions.flatMap(ext => ext.helpMessages.student)
    );
    serverSettingsMainMenuOptions.push(
        ...interactionExtensions.flatMap(ext => ext.settingsMainMenuOptions)
    );
}
