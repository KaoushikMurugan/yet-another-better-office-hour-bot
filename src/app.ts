import { Guild, Collection, VoiceState } from 'discord.js';
import { AttendingServerV2 } from './attending-server/base-attending-server';
import { BuiltInButtonHandler } from './command-handling/button-handler';
import { BuiltInCommandHandler } from './command-handling/command-handler';
import { magenta, black, cyan, green, red, yellow } from './utils/command-line-colors';
import { postSlashCommands } from './command-handling/slash-commands';
import { EmbedColor, ErrorEmbed, SimpleEmbed } from './utils/embed-helper';
import { CalendarInteractionExtension } from './extensions/session-calendar/calendar-command-extension';
import { IInteractionExtension } from './extensions/extension-interface';
import { GuildId, WithRequired } from './utils/type-aliases';
import { client, attendingServers } from './global-states';
import { BuiltInModalHandler } from './command-handling/modal-handler';
import { CommandNotImplementedError } from './utils/error-types';
import environment from './environment/environment-manager';

const interactionExtensions: Collection<GuildId, IInteractionExtension[]> =
    new Collection();
const builtinCommandHandler = new BuiltInCommandHandler();
const builtinButtonHandler = new BuiltInButtonHandler();
const builtinModalHandler = new BuiltInModalHandler();

/**
 * After login startup seqence
 */
client.on('ready', async () => {
    if (client.user === null) {
        throw new Error("Login Unsuccessful. Check YABOB's Discord Credentials");
    }
    printTitleString(client.user.username);
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

client.on('interactionCreate', async interaction => {
    // if it's a built-in command/button, process
    // otherwise find an extension that can process it
    // TODO: All 3 if blocks are basically the same, see if we can generalize them
    let handled = false;
    if (interaction.isChatInputCommand()) {
        if (builtinCommandHandler.canHandle(interaction)) {
            handled = true;
            await builtinCommandHandler.process(interaction);
        } else {
            const externalCommandHandler = interactionExtensions
                // default value is for semantics only
                .get(interaction.guild?.id ?? 'Non-Guild Interaction')
                ?.find(ext => ext.canHandleCommand(interaction));
            handled = externalCommandHandler !== undefined;
            await externalCommandHandler?.processCommand(interaction);
        }
    }
    if (interaction.isButton()) {
        if (builtinButtonHandler.canHandle(interaction)) {
            handled = true;
            await builtinButtonHandler.process(interaction);
        } else {
            const externalButtonHandler = interactionExtensions
                .get(interaction.guild?.id ?? 'Non-Guild Interaction')
                ?.find(ext => ext.canHandleButton(interaction));
            handled = externalButtonHandler !== undefined;
            await externalButtonHandler?.processButton(interaction);
        }
    }
    if (interaction.isModalSubmit()) {
        if (builtinModalHandler.canHandle(interaction)) {
            handled = true;
            await builtinModalHandler.process(interaction);
        } else {
            const externalModalHandler = interactionExtensions
                .get(interaction.guild?.id ?? 'Non-Guild Interaction')
                ?.find(ext => ext.canHandleModalSubmit(interaction));
            handled = externalModalHandler !== undefined;
            await externalModalHandler?.processModalSubmit(interaction);
        }
    }
    // optional, remove it if you feel like this is too ugly
    if (!handled && interaction.isRepliable()) {
        await interaction.reply({
            ...ErrorEmbed(
                new CommandNotImplementedError(
                    `YABOB cannot handle this ${interaction.toString()}.`
                )
            ),
            ephemeral: true
        });
    }
});

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
        role.name === client.user?.username &&
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

client.on('error', err => {
    console.error(red('Uncaught DiscordJS Error:'), `${err.message}\n`, err.stack);
});

client.on('warn', warning => {
    console.warn(magenta('Uncaught DiscordJS Warning:'), warning);
});

process.on('exit', () => {
    console.log(centered('-------- End of Server Log --------'));
    console.log(`${centered('-------- Begin Error Stack Trace --------')}\n`);
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

function printTitleString(username: string): void {
    const titleString = 'YABOB: Yet-Another-Better-OH-Bot V4.1';
    console.log(`Environment: ${cyan(environment.env)}`);
    console.log(`Logged in as ${username}!`);
    console.log('Scanning servers I am a part of...');
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
}

function centered(text: string): string {
    return (
        `${' '.repeat((process.stdout.columns - text.length) / 2)}` +
        `${text}` +
        `${' '.repeat((process.stdout.columns - text.length) / 2)}`
    );
}
