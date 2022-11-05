import { Guild, Collection, VoiceState, Interaction } from 'discord.js';
import { AttendingServerV2 } from './attending-server/base-attending-server.js';
import {
    builtInButtonHandlerCanHandle,
    processBuiltInButton
} from './command-handling/button-handler.js';
import {
    builtInCommandHandlerCanHandle,
    processBuiltInCommand
} from './command-handling/command-handler.js';
import {
    builtInModalHandlercanHandle,
    processBuiltInModalSubmit
} from './command-handling/modal-handler.js';
import { magenta, black, cyan, green, red, yellow } from './utils/command-line-colors.js';
import { postSlashCommands } from './command-handling/slash-commands.js';
import { EmbedColor, SimpleEmbed } from './utils/embed-helper.js';
import { CalendarInteractionExtension } from './extensions/session-calendar/calendar-command-extension.js';
import { IInteractionExtension } from './extensions/extension-interface.js';
import { GuildId, WithRequired } from './utils/type-aliases.js';
import { client, attendingServers } from './global-states.js';
import { environment } from './environment/environment-manager.js';
import { updatePresence } from './utils/discord-presence.js';
import { centered } from './utils/util-functions.js';
import { UnexpectedParseErrors } from './command-handling/expected-interaction-errors.js';

const interactionExtensions = new Collection<GuildId, IInteractionExtension[]>();
const failedInteractions: { username: string; interaction: Interaction }[] = [];

/**
 * After login startup seqence
 */
client.on('ready', async () => {
    printTitleString();
    // completeGuilds is all the servers this YABOB instance has joined
    const clientGuilds = await client.guilds.fetch();
    const completeGuilds = await Promise.all(clientGuilds.map(guild => guild.fetch()));
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
    //set first presence
    updatePresence();
    //update presence every 30 minutes
    setInterval(updatePresence, 1000 * 60 * 30);
});

/**
 * Server joining procedure
 */
client.on('guildCreate', async guild => {
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
client.on('guildDelete', async guild => {
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
client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.inCachedGuild() || !interaction.inGuild()) {
        // required check to make sure all the types are safe
        interaction.isRepliable() &&
            (await interaction.reply(
                SimpleEmbed('I can only accept server based interactions.')
            ));
        return;
    }
    dispatchInteractions(interaction).catch(async (err: Error) => {
        interaction.user
            .send(UnexpectedParseErrors.unexpectedError(interaction, err))
            .catch(() => {
                failedInteractions.push({
                    username: interaction.user.username,
                    interaction: interaction
                });
            });
    });
    if (failedInteractions.length >= 50) {
        console.error('These 50 interactions failed: ');
        console.error(failedInteractions);
        failedInteractions.splice(0, failedInteractions.length);
    }
});

/**
 * Gives the Student role to new members
 */
client.on('guildMemberAdd', async member => {
    const server =
        attendingServers.get(member.guild.id) ?? (await joinGuild(member.guild));
    const studentRole = server.guild.roles.cache.find(role => role.name === 'Student');
    if (studentRole !== undefined && !member.user.bot) {
        await member.roles.add(studentRole);
    }
});

/**
 * Used for inviting YABOB to a server with existing roles
 * Once YABOB has the highest role, start the initialization call
 */
client.on('roleUpdate', async role => {
    if (attendingServers.has(role.guild.id)) {
        return;
    }
    if (
        role.name === client.user.username &&
        role.guild.roles.highest.name === client.user.username
    ) {
        console.log(cyan('Got the highest Role! Starting server initialization'));
        const owner = await role.guild.fetchOwner();
        await Promise.all([
            owner.send(
                SimpleEmbed(
                    `Got the highest Role!` +
                        ` Starting server initialization for ${role.guild.name}`,
                    EmbedColor.Success
                )
            ),
            joinGuild(role.guild)
        ]);
    }
});

/**
 * Track when members join or leave a voice channel
 */
client.on('voiceStateUpdate', async (oldVoiceState, newVoiceState) => {
    if (newVoiceState.member === null) {
        throw new Error('Received VC event in a server without initialized YABOB.');
    }
    const serverId = oldVoiceState.guild.id;
    const isLeaveVC = oldVoiceState.channel !== null && newVoiceState.channel === null;
    const isJoinVC = oldVoiceState.channel === null && newVoiceState.channel !== null;
    if (isLeaveVC) {
        await attendingServers.get(serverId)?.onMemberLeaveVC(
            newVoiceState.member,
            // already checked in isLeaveVC condition
            oldVoiceState as WithRequired<VoiceState, 'channel'>
        );
    } else if (isJoinVC) {
        await attendingServers.get(serverId)?.onMemberJoinVC(
            newVoiceState.member,
            // already checked in isJoinVC condition
            newVoiceState as WithRequired<VoiceState, 'channel'>
        );
    }
});

/**
 * Discord.js warning handling
 */
client.on('warn', warning => {
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
    if (client.user === null) {
        throw Error('Please wait until YABOB has logged in ' + 'to manage the server');
    }
    console.log(`Joining guild: ${yellow(guild.name)}`);
    if (!environment.disableExtensions) {
        interactionExtensions.set(
            guild.id,
            await Promise.all([CalendarInteractionExtension.load(guild)])
        );
    }
    // Extensions for server&queue are loaded inside the create method
    const server = await AttendingServerV2.create(client.user, guild);
    attendingServers.set(guild.id, server);
    await postSlashCommands(
        guild,
        interactionExtensions.get(guild.id)?.flatMap(ext => ext.slashCommandData)
    );
    return server;
}

/**
 * Dispatches the interaction to different handlers.
 * @param interaction from the client.on('interactionCreate') event
 * @returns boolean, whether the command was handled
 */
async function dispatchInteractions(
    interaction: Interaction<'cached'>
): Promise<boolean> {
    // if it's a built-in command/button, process
    // otherwise find an extension that can process it
    if (interaction.isChatInputCommand()) {
        if (builtInCommandHandlerCanHandle(interaction)) {
            await processBuiltInCommand(interaction);
            return true;
        } else {
            const externalCommandHandler = interactionExtensions
                // default value is for semantics only
                .get(interaction.guildId ?? 'Non-Guild Interaction')
                ?.find(ext => ext.canHandleCommand(interaction));
            await externalCommandHandler?.processCommand(interaction);
            return externalCommandHandler !== undefined;
        }
    }
    if (interaction.isButton()) {
        if (builtInButtonHandlerCanHandle(interaction)) {
            await processBuiltInButton(interaction);
            return true;
        } else {
            const externalButtonHandler = interactionExtensions
                .get(interaction.guildId ?? 'Non-Guild Interaction')
                ?.find(ext => ext.canHandleButton(interaction));
            await externalButtonHandler?.processButton(interaction);
            return externalButtonHandler !== undefined;
        }
    }
    if (interaction.isModalSubmit()) {
        if (builtInModalHandlercanHandle(interaction)) {
            await processBuiltInModalSubmit(interaction);
            return true;
        } else {
            const externalModalHandler = interactionExtensions
                .get(interaction.guildId ?? 'Non-Guild Interaction')
                ?.find(ext => ext.canHandleModalSubmit(interaction));
            await externalModalHandler?.processModalSubmit(interaction);
            return externalModalHandler !== undefined;
        }
    }
    return false;
}

/**
 * Prints the title message for the console upon startup
 * @param username
 */
function printTitleString(): void {
    const titleString = 'YABOB: Yet-Another-Better-OH-Bot V4.2';
    console.log(`Environment: ${cyan(environment.env)}`);
    console.log(
        `\n${black(
            magenta(
                ' '.repeat((process.stdout.columns - titleString.length) / 2) +
                    titleString +
                    ' '.repeat((process.stdout.columns - titleString.length) / 2),
                'Bg'
            )
        )}\n`
    );
    console.log('Scanning servers I am a part of...');
}
