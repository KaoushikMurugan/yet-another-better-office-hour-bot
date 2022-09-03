import dotenv from "dotenv";
import { Client, Guild, Intents, Collection } from "discord.js";
import { AttendingServerV2 } from "./attending-server/base-attending-server";
import { ButtonCommandDispatcher } from "./command-handling/button-handler";
import { CentralCommandDispatcher } from "./command-handling/command-handler";
import {
    BgMagenta, FgBlack, FgCyan,
    FgGreen, FgMagenta, FgRed, FgYellow, ResetColor
} from './utils/command-line-colors';
import { postSlashCommands } from "./command-handling/slash-commands";
import { EmbedColor, SimpleEmbed } from "./utils/embed-helper";
import { CalendarCommandExtension } from './extensions/session-calendar/calendar-command-extension';
import { IInteractionExtension } from "./extensions/extension-interface";

dotenv.config();
console.log(`Environment: ${FgCyan}${process.env.NODE_ENV}${ResetColor}`);

if (process.env.NODE_ENV === 'Production') {
    process.removeAllListeners('warning');
}

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
const serversV2: Collection<string, AttendingServerV2> = new Collection();
const interactionExtensions: Collection<string, IInteractionExtension[]> = new Collection();

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
    const allGuilds = await Promise.all(
        (await client.guilds.fetch()).map(guild => guild.fetch())
    );

    // Launch all startup sequences in parallel
    const setupResult = await Promise.allSettled(allGuilds.map(guild => joinGuild(guild)));
    setupResult.forEach(result =>
        result.status === 'rejected' &&
        console.log(`${result.reason}`)
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
 * ----
*/
client.on("guildCreate", async guild => {
    console.log(`${FgMagenta}Got invited to:${ResetColor} '${guild.name}'!`);
    await joinGuild(guild)
        .catch(() => console.error(
            `${FgRed}Please give me the highest role in: ${ResetColor}'${guild.name}'.`
        ));
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
    // if it's a built-in command/button, process
    // otherwise find an extension that can process it
    if (interaction.isCommand()) {
        const builtinCommandHandler = new CentralCommandDispatcher(serversV2);
        if (builtinCommandHandler.commandMethodMap.has(interaction.commandName)) {
            await builtinCommandHandler.process(interaction);
        } else {
            const externalCommandHandler = interactionExtensions
                .get(interaction.guild?.id ?? '')
                ?.find(ext => ext.commandMethodMap.has(interaction.commandName));
            await externalCommandHandler?.processCommand(interaction);
        }
    }
    if (interaction.isButton()) {
        const buttonName = interaction.customId.split(' ')[0] ?? '';
        const builtinButtonHandler = new ButtonCommandDispatcher(serversV2);
        if (builtinButtonHandler.buttonMethodMap.has(buttonName)) {
            await builtinButtonHandler.process(interaction);
        } else {
            const externalButtonHandler = interactionExtensions
                .get(interaction.guild?.id ?? '')
                ?.find(ext => ext.commandMethodMap.has(buttonName));
            await externalButtonHandler?.processButton(interaction);
        }
    }
});

client.on("guildMemberAdd", async member => {
    const server = serversV2.get(member.guild.id)
        ?? await joinGuild(member.guild);
    const studentRole = server.guild.roles.cache
        .find(role => role.name === 'Student');
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
    if (serversV2.has(role.guild.id)) {
        return;
    }
    if (role.name === client.user?.username &&
        role.guild.roles.highest.name === client.user.username) {
        console.log(
            `${FgCyan}Got the highest Role! Starting server initialization${ResetColor}`
        );
        const owner = await role.guild.fetchOwner();
        await Promise.all([
            owner.send(SimpleEmbed(
                `Got the highest Role!` +
                ` Starting server initialization for ${role.guild.name}`,
                EmbedColor.Success
            )),
            joinGuild(role.guild)
        ]);
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
        throw Error(
            'Please wait until YABOB has logged in ' +
            'to manage the server'
        );
    }

    console.log(`Joining guild: ${FgYellow}${guild.name}${ResetColor}`);

    // Extensions for server&queue are loaded inside the create method
    const server = await AttendingServerV2.create(client.user, guild);
    serversV2.set(guild.id, server);
    interactionExtensions.set(guild.id, [new CalendarCommandExtension(guild)]);

    await postSlashCommands(
        guild,
        interactionExtensions
            .get(guild.id)
            ?.flatMap(ext => ext.slashCommandData)
    );
    return server;
}

function printTitleString(): void {
    const titleString = "YABOB: Yet-Another-Better-OH-Bot V4.0";
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