import { Guild, Collection, VoiceState } from 'discord.js';
import { AttendingServerV2 } from './attending-server/base-attending-server';
import { ButtonCommandDispatcher } from './command-handling/button-handler';
import { CentralCommandDispatcher } from './command-handling/command-handler';
import { magenta, black, cyan, green, red, yellow } from './utils/command-line-colors';
import { postSlashCommands } from './command-handling/slash-commands';
import { EmbedColor, SimpleEmbed } from './utils/embed-helper';
import { CalendarInteractionExtension } from './extensions/session-calendar/calendar-command-extension';
import { IInteractionExtension } from './extensions/extension-interface';
import { GuildId, WithRequired } from './utils/type-aliases';
import { logEditFailure } from './command-handling/common-validations';
import { client, attendingServers } from './global-states';
import environment from './environment/environment-manager';

const interactionExtensions: Collection<GuildId, IInteractionExtension[]> =
    new Collection();
const builtinCommandHandler = new CentralCommandDispatcher();
const builtinButtonHandler = new ButtonCommandDispatcher();

client.on('error', console.error);

/**
 * After login startup seqence
 */
client.on('ready', async () => {
    if (client.user === null) {
        throw new Error("Login Unsuccessful. Check YABOB's Discord Credentials");
    }
    printTitleString(client.user.username);
    // allGuilds is all the servers this YABOB instance has joined
    const allGuilds = await Promise.all(
        (await client.guilds.fetch()).map(guild => guild.fetch())
    );
    // Launch all startup sequences in parallel
    const setupResult = await Promise.allSettled(
        allGuilds.map(guild => joinGuild(guild))
    );
    setupResult.forEach(
        result => result.status === 'rejected' && console.log(`${result.reason}`)
    );
    if (setupResult.filter(res => res.status === 'fulfilled').length === 0) {
        console.error('All server setups failed. Aborting.');
        process.exit(1);
    }
    console.log(`\n✅ ${green('Ready to go!')} ✅\n`);
    console.log(`${centeredText('-------- Begin Server Logs --------')}\n`);
    return;
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
    // The IIFE syntax is only used for cleaner catch
    // TODO: consider using Result<ReturnType, Error> inside command handler
    if (interaction.isChatInputCommand()) {
        await (async () => {
            // there's the 3 second rule, we have to catch it asap
            if (builtinCommandHandler.canHandle(interaction)) {
                await builtinCommandHandler.process(interaction);
            } else {
                const externalCommandHandler = interactionExtensions
                    .get(interaction.guild?.id ?? '')
                    ?.find(ext => ext.commandMethodMap.has(interaction.commandName));
                if (!externalCommandHandler) {
                    return;
                }
                await externalCommandHandler.processCommand(interaction);
            }
        })().catch(logEditFailure);
    }
    if (interaction.isButton()) {
        await (async () => {
            if (builtinButtonHandler.canHandle(interaction)) {
                await builtinButtonHandler.process(interaction);
            } else {
                const externalButtonHandler = interactionExtensions
                    .get(interaction.guild?.id ?? '')
                    ?.find(ext => ext.canHandleButton(interaction));
                if (!externalButtonHandler) {
                    await interaction.reply({
                        content: 'Unknown interaction',
                        ephemeral: true
                    });
                    return;
                }
                await externalButtonHandler.processButton(interaction);
            }
        })().catch(logEditFailure);
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

process.on('exit', () => {
    console.log(centeredText('-------- End of Server Log --------'));
    console.log(`${centeredText('-------- Begin Error Stack Trace --------')}\n`);
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
            await Promise.all([
                CalendarInteractionExtension.load(guild, attendingServers)
            ])
        );
    }
    // Extensions for server&queue are loaded inside the create method
    const server = await AttendingServerV2.create(client.user, guild);
    attendingServers.set(guild.id, server);
    [...interactionExtensions.values()]
        .flat()
        .forEach(extension => (extension.serverMap = attendingServers));
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

function centeredText(text: string): string {
    return (
        `${' '.repeat((process.stdout.columns - text.length) / 2)}` +
        `${text}` +
        `${' '.repeat((process.stdout.columns - text.length) / 2)}`
    );
}
