// Library Imports
import { Client, Guild, Intents } from "discord.js";
// Credentials
import dotenv from "dotenv";
// Local imports
import { AttendingServerV2 } from "./attending-server/base-attending-server";
import { ButtonCommandDispatcher } from "./command-handling/button-handler";
import { CentralCommandDispatcher } from "./command-handling/command-handler";
import {
    BgMagenta, FgBlack, FgCyan,
    FgGreen, FgRed, FgYellow, ResetColor
} from './utils/command-line-colors';
import { postSlashCommands } from "./command-handling/slash-commands";

dotenv.config();
console.log(`Environment: ${FgCyan}${process.env.NODE_ENV}${ResetColor}`);

if (process.env.YABOB_BOT_TOKEN === undefined ||
    process.env.YABOB_APP_ID === undefined
) {
    throw new Error("Missing token or bot ID. Aborting setup.");
}

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_INVITES,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_PRESENCES,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
    ],
});

// key is Guild.id
const serversV2: Map<string, AttendingServerV2> = new Map();

client.login(process.env.YABOB_BOT_TOKEN).catch((err: Error) => {
    console.error("Login Unsuccessful. Check YABOBs credentials.");
    throw err;
});

client.on("error", error => {
    console.error(error);
});

/**
 * After login startup seqence
 * ----
*/
client.on("ready", async () => {
    if (client.user === null) {
        throw new Error(
            "Login Unsuccessful. Check YABOB's Discord Credentials"
        );
    }
    printTitleString();
    console.log(`Logged in as ${client.user.tag}!`);
    console.log("Scanning servers I am a part of...");

    // allGuilds is all the servers this YABOB instance has joined
    const allGuilds = await Promise
        .all((await client.guilds.fetch()).map(guild => guild.fetch()));

    // Launch all startup sequences in parallel
    await Promise.all(
        allGuilds.map(guild => joinGuild(guild)
            .catch(() => console.error(`${FgRed}Please give me the highest role.${ResetColor}`)
            )));

    console.log(`\n✅ ${FgGreen}Ready to go!${ResetColor} ✅\n`);
    console.log(`${centeredText('-------- Begin Server Logs --------')}\n`);
    return;
});

/**
 * Server joining procedure
 * ----
*/
client.on("guildCreate", async guild => {
    console.log(`Got invited to '${guild.name}'!`);
    await joinGuild(guild)
        .catch(() => console.error(`${FgRed}Please give me the highest role.${ResetColor}`));
});

/**
 * Server exit procedure
 * ----
 * - Clears all the periodic updates
 * - Deletes server from server map
*/
client.on("guildDelete", async guild => {
    const server = serversV2.get(guild.id);
    if (server !== undefined) {
        server.clearAllIntervals();
        serversV2.delete(guild.id);
        console.log(
            `${FgRed}Leaving ${guild.name}. ` +
            `Backups will be saved by the extensions.${ResetColor}`
        );
    }
});

client.on("interactionCreate", async interaction => {
    if (interaction.isCommand()) {
        const commandHandler = new CentralCommandDispatcher(serversV2);
        await commandHandler.process(interaction);
    }
    if (interaction.isButton()) {
        const buttonHandler = new ButtonCommandDispatcher(serversV2);
        await buttonHandler.process(interaction);
    }
});

client.on("guildMemberAdd", async member => {
    const server = serversV2.get(member.guild.id) ?? await joinGuild(member.guild);
    const studentRole = server.guild.roles.cache.find(role => role.name === 'Student');
    if (studentRole !== undefined) {
        await member.roles.add(studentRole);
    }
});

/**
 * Used for inviting YABOB to a server with existing roles
 * ----
 * Once YABOB has the highest role, start the initialization call
 */
client.on("roleUpdate", async role => {
    if (role.name === client.user?.username &&
        role.guild.roles.highest.name === client.user.username) {
        console.log('Got the highest Role! Starting server initialization');
        await joinGuild(role.guild);
    }
});

process.on('exit', () => {
    console.log(`${centeredText('-------- End of Server Log --------')}`);
    console.log(`${centeredText('-------- Begin Error Stack Trace --------')}\n`);
});

/**
 * Initilization sequence
 * ----
 * @param guild server to join
 * @returns AttendingServerV2 if successfully initialized
 */
async function joinGuild(guild: Guild): Promise<AttendingServerV2> {
    if (client.user === null) {
        throw Error('Please wait until YABOB has logged in '
            + 'to manage the server');
    }

    console.log(`Joining guild: ${FgYellow}${guild.name}${ResetColor}`);
    await postSlashCommands(guild);

    // Extensions are loaded inside the create method
    const server = await AttendingServerV2.create(client.user, guild);
    serversV2.set(guild.id, server);
    return server;
}

function printTitleString(): void {
    const titleString = "YABOB: Yet-Another-Better-OH-Bot V4";
    console.log(
        `\n${FgBlack}${BgMagenta}${' '.repeat((process.stdout.columns - titleString.length) / 2)}` +
        `${titleString}` +
        `${' '.repeat((process.stdout.columns - titleString.length) / 2)}${ResetColor}\n`
    );
}

function centeredText(text: string): string {
    return `${' '.repeat((process.stdout.columns - text.length) / 2)}` +
        `${text}` +
        `${' '.repeat((process.stdout.columns - text.length) / 2)}`;
}