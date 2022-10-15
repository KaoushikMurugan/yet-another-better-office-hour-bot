import { Client, Guild, GatewayIntentBits, Collection, VoiceState } from 'discord.js';
import { AttendingServerV2 } from './attending-server/base-attending-server';
import { ButtonCommandDispatcher } from './command-handling/button-handler';
import { CentralCommandDispatcher } from './command-handling/command-handler';
import {
    BgMagenta,
    FgBlack,
    FgCyan,
    BgYellow,
    FgGreen,
    FgMagenta,
    FgRed,
    FgYellow,
    ResetColor,
    BgCyan
} from './utils/command-line-colors';
import { postSlashCommands } from './command-handling/slash-commands';
import { EmbedColor, SimpleEmbed } from './utils/embed-helper';
import { CalendarInteractionExtension } from './extensions/session-calendar/calendar-command-extension';
import { IInteractionExtension } from './extensions/extension-interface';
import { GuildId, WithRequired } from './utils/type-aliases';
import { logEditFailure } from './command-handling/common-validations';
import environment from './environment/environment-manager';

if (
    environment.discordBotCredentials.YABOB_BOT_TOKEN.length === 0 ||
    environment.discordBotCredentials.YABOB_APP_ID.length === 0
) {
    throw new Error('Missing token or bot ID. Aborting setup.');
}

if (environment.disableExtensions) {
    console.log(`${BgYellow}${FgBlack}Running without extensions.${ResetColor}`);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

// key is Guild.id
const serversV2: Collection<GuildId, AttendingServerV2> = new Collection();
const interactionExtensions: Collection<GuildId, IInteractionExtension[]> =
    new Collection();
const builtinCommandHandler = new CentralCommandDispatcher(serversV2);
const builtinButtonHandler = new ButtonCommandDispatcher(serversV2);

client.login(environment.discordBotCredentials.YABOB_BOT_TOKEN).catch((err: Error) => {
    console.error('Login Unsuccessful. Check YABOBs credentials.');
    throw err;
});

client.on('error', console.error);

/**
 * After login startup seqence
 */
client.on('ready', async () => {
    if (client.user === null) {
        throw new Error("Login Unsuccessful. Check YABOB's Discord Credentials");
    }
    console.log(`Env: ${BgCyan}${environment.env}${ResetColor}`);
    printTitleString();
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Scanning servers I am a part of...');
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
    console.log(`\n✅ ${FgGreen}Ready to go!${ResetColor} ✅\n`);
    console.log(`${centeredText('-------- Begin Server Logs --------')}\n`);
    return;
});

/**
 * Server joining procedure
 */
client.on('guildCreate', async guild => {
    console.log(`${FgMagenta}Got invited to:${ResetColor} '${guild.name}'!`);
    await joinGuild(guild).catch(() =>
        console.error(
            `${FgRed}Please give me the highest role in: ${ResetColor}'${guild.name}'.`
        )
    );
});

/**
 * Server exit procedure
 * - Clears all the periodic updates
 * - Deletes server from server map
 */
client.on('guildDelete', async guild => {
    const server = serversV2.get(guild.id);
    if (server !== undefined) {
        server.clearAllServerTimers();
        await server.gracefulDelete();
        serversV2.delete(guild.id);
        console.log(
            `${FgRed}Leaving ${guild.name}. ` +
                `Backups will be saved by the extensions.${ResetColor}`
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
                builtinButtonHandler.serverMap = serversV2;
                await builtinButtonHandler.process(interaction);
            } else {
                const externalButtonHandler = interactionExtensions
                    .get(interaction.guild?.id ?? '')
                    ?.find(ext => ext.canHandleButton(interaction));
                if (!externalButtonHandler) {
                    await interaction.reply('Unknown interaction');
                    return;
                }
                await externalButtonHandler.processButton(interaction);
            }
        })().catch(logEditFailure);
    }
});

client.on('guildMemberAdd', async member => {
    const server = serversV2.get(member.guild.id) ?? (await joinGuild(member.guild));
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
    if (serversV2.has(role.guild.id)) {
        return;
    }
    if (
        role.name === client.user?.username &&
        role.guild.roles.highest.name === client.user.username
    ) {
        console.log(
            `${FgCyan}Got the highest Role! Starting server initialization${ResetColor}`
        );
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
        await serversV2.get(serverId)?.onMemberLeaveVC(
            newVoiceState.member,
            // already checked in isLeaveVC condition
            oldVoiceState as WithRequired<VoiceState, 'channel'>
        );
    } else if (isJoinVC) {
        await serversV2.get(serverId)?.onMemberJoinVC(
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
    console.log(`Joining guild: ${FgYellow}${guild.name}${ResetColor}`);
    if (!environment.disableExtensions) {
        interactionExtensions.set(
            guild.id,
            await Promise.all([CalendarInteractionExtension.load(guild, serversV2)])
        );
    }
    // Extensions for server&queue are loaded inside the create method
    const server = await AttendingServerV2.create(client.user, guild);
    serversV2.set(guild.id, server);
    // update serverMap for all interaction handlers
    builtinCommandHandler.serverMap = serversV2;
    builtinButtonHandler.serverMap = serversV2;
    [...interactionExtensions.values()]
        .flat()
        .forEach(extension => (extension.serverMap = serversV2));
    await postSlashCommands(
        guild,
        interactionExtensions.get(guild.id)?.flatMap(ext => ext.slashCommandData)
    );
    return server;
}

function printTitleString(): void {
    const titleString = 'YABOB: Yet-Another-Better-OH-Bot V4.1';
    console.log(
        `\n${FgBlack}${BgMagenta}${' '.repeat(
            (process.stdout.columns - titleString.length) / 2
        )}` +
            `${titleString}` +
            `${' '.repeat(
                (process.stdout.columns - titleString.length) / 2
            )}${ResetColor}\n`
    );
}

function centeredText(text: string): string {
    return (
        `${' '.repeat((process.stdout.columns - text.length) / 2)}` +
        `${text}` +
        `${' '.repeat((process.stdout.columns - text.length) / 2)}`
    );
}
