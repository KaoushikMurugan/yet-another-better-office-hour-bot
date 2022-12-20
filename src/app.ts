import { Guild, Interaction, Events } from 'discord.js';
import { AttendingServerV2 } from './attending-server/base-attending-server.js';
import {
    interactionExtensions,
    dispatchDMInteraction,
    dispatchServerInteractions
} from './command-handling/interaction-index.js';
import { magenta, cyan, green, red, yellow } from './utils/command-line-colors.js';
import { postSlashCommands } from './command-handling/command/slash-commands.js';
import { EmbedColor, SimpleEmbed } from './utils/embed-helper.js';
import { CalendarInteractionExtension } from './extensions/session-calendar/calendar-command-extension.js';
import { client, attendingServers } from './global-states.js';
import { environment } from './environment/environment-manager.js';
import { updatePresence } from './utils/discord-presence.js';
import {
    centered,
    printTitleString,
    isLeaveVC,
    isJoinVC
} from './utils/util-functions.js';
import { UnexpectedParseErrors } from './command-handling/expected-interaction-errors.js';
import { RolesConfigMenu } from './attending-server/server-settings-menus.js';

const failedInteractions: Array<{ username: string; interaction: Interaction }> = [];

/**
 * After login startup seqence
 */
client.on(Events.ClientReady, async () => {
    printTitleString();
    // completeGuilds is all the servers this YABOB instance has joined
    const completeGuilds = await Promise.all(
        client.guilds.cache.map(guild => guild.fetch())
    );
    const setupResults = await Promise.allSettled(
        completeGuilds.map(guild => joinGuild(guild))
    );
    setupResults.forEach(
        result => result.status === 'rejected' && console.log(`${result.reason}`)
    );
    if (setupResults.filter(result => result.status === 'fulfilled').length === 0) {
        console.error('All server setups failed. Aborting.');
        process.exit(1);
    }
    console.log(`\n✅ ${green('Ready to go!')} ✅\n`);
    console.log(`${centered('-------- Begin Server Logs --------')}\n`);
    updatePresence();
    setInterval(updatePresence, 1000 * 60 * 30);
});

/**
 * Server joining procedure
 */
client.on(Events.GuildCreate, async guild => {
    console.log(`${magenta('Got invited to:')} '${guild.name}'!`);
    await joinGuild(guild).catch(() =>
        console.error(`${red('Please give me the highest role in:')} '${guild.name}'.`)
    );
});

/**
 * Server exit procedure
 * - Clears all the periodic updates
 * - Deletes server from server map
 */
client.on(Events.GuildDelete, async guild => {
    const server = attendingServers.get(guild.id);
    if (server !== undefined) {
        server.clearAllServerTimers();
        await server.gracefulDelete();
        attendingServers.delete(guild.id);
        console.log(
            red(`Leaving ${guild.name}. Backups will be saved by the extensions.`)
        );
    }
});

/**
 * Handles all interactions
 * - Slash commands
 * - Button presses
 * - Modal submissions
 */
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (interaction.channel?.isDMBased()) {
        dispatchDMInteraction(interaction).catch((err: Error) => {
            interaction.user
                .send(UnexpectedParseErrors.unexpectedError(interaction, err))
                .catch(() =>
                    failedInteractions.push({
                        username: interaction.user.username,
                        interaction: interaction
                    })
                );
        });
        return;
    }
    if (!interaction.inCachedGuild()) {
        // required check to make sure all the types are safe
        interaction.isRepliable() &&
            (await interaction.reply(
                SimpleEmbed('I can only accept server based interactions.')
            ));
        return;
    }
    dispatchServerInteractions(interaction).catch((err: Error) => {
        interaction.user
            .send(UnexpectedParseErrors.unexpectedError(interaction, err))
            .catch(() =>
                failedInteractions.push({
                    username: interaction.user.username,
                    interaction: interaction
                })
            );
    });
    if (failedInteractions.length >= 5) {
        console.error(`These ${failedInteractions.length} interactions failed: `);
        console.error(failedInteractions);
        failedInteractions.splice(0, failedInteractions.length);
    }
});

/**
 * Gives the Student role to new members
 */
client.on(Events.GuildMemberAdd, async member => {
    const server =
        attendingServers.get(member.guild.id) ?? (await joinGuild(member.guild));
    if (!server.autoGiveStudentRole) {
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
        await member.roles.add(studentRole);
    }
});

/**
 * Used for inviting YABOB to a server with existing roles
 * Once YABOB has the highest role, start the initialization call
 */
client.on(Events.GuildRoleUpdate, async role => {
    if (attendingServers.has(role.guild.id)) {
        return;
    }
    if (
        role.name === client.user.username &&
        role.guild.roles.highest.name === client.user.username
    ) {
        console.log(cyan('Got the highest Role! Starting server initialization'));
        const owner = await role.guild.fetchOwner();
        const [server] = await Promise.all([
            joinGuild(role.guild),
            owner.send(
                SimpleEmbed(
                    `Got the highest Role!` +
                        ` Starting server initialization for ${role.guild.name}`,
                    EmbedColor.Success
                )
            )
        ]);
        await owner.send(RolesConfigMenu(server, owner.id, true, true));
    }
});

/**
 * Track when members join or leave a voice channel
 */
client.on(Events.VoiceStateUpdate, async (oldVoiceState, newVoiceState) => {
    if (newVoiceState.member === null) {
        throw new Error('Received VC event in a server without initialized YABOB.');
    }
    const serverId = oldVoiceState.guild.id;
    if (isLeaveVC(oldVoiceState, newVoiceState)) {
        await attendingServers
            .get(serverId)
            ?.onMemberLeaveVC(newVoiceState.member, oldVoiceState);
    } else if (isJoinVC(oldVoiceState, newVoiceState)) {
        await attendingServers
            .get(serverId)
            ?.onMemberJoinVC(newVoiceState.member, newVoiceState);
    }
});

client.on(Events.GuildRoleDelete, async role => {
    attendingServers.get(role.guild.id)?.onRoleDelete(role);
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
 * YABOB Initilization sequence
 * @param guild server to join
 * @returns AttendingServerV2 if successfully initialized
 * @throws ServerError if the AttendingServerV2.create failed
 */
async function joinGuild(guild: Guild): Promise<AttendingServerV2> {
    console.log(`Joining guild: ${yellow(guild.name)}`);
    if (!environment.disableExtensions) {
        interactionExtensions.set(
            guild.id,
            await Promise.all([
                CalendarInteractionExtension.load(guild),
                GoogleSheetInteractionExtension.load(guild)
            ])
        );
    }
    // Extensions for server&queue are loaded inside the create method
    const server = await AttendingServerV2.create(guild);
    attendingServers.set(guild.id, server);
    await postSlashCommands(
        guild,
        interactionExtensions.get(guild.id)?.flatMap(ext => ext.slashCommandData)
    );
    await server.guild.commands.fetch(); // populate cache
    return server;
}
