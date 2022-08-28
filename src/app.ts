// Library Imports
import {
    Client,
    CommandInteraction,
    Guild,
    Intents,
} from "discord.js";

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Local Imports
import dotenv from "dotenv";
import fbs_creds from "../fbs_service_account_key.json";

import { AttendingServerV2 } from "./attending-server/base-attending-server";
import { CentralCommandDispatcher } from "./command-handling/centeral-handler";
import { postSlashCommands } from "./command-handling/slash-commands";

dotenv.config();
console.log(`Environment: ${process.env.NODE_ENV}`);

if (process.env.YABOB_BOT_TOKEN === undefined ||
    process.env.YABOB_APP_ID === undefined
) {
    throw new Error("Missing token or id. Aborting setup.");
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

initializeApp({
    credential: cert(fbs_creds)
});
const firebase_db: FirebaseFirestore.Firestore = getFirestore();
console.log("Connected to Firebase database");

const serversV2: Map<string, AttendingServerV2> = new Map();

client.login(process.env.YABOB_BOT_TOKEN).catch((e: Error) => {
    console.error("Login Unsuccessful. Check YABOBs credentials.");
    throw e;
});

client.on("error", error => {
    console.error(error);
});

client.on("ready", async () => {
    console.log("\x1b[45mYABOB: Yet-Another-Better-OH-Bot V3\x1b[0m");
    if (client.user === null) {
        throw new Error(
            "Login Unsuccessful. Check YABOB's Discord Credentials"
        );
    }
    console.log(`Logged in as ${client.user.tag}!`);
    console.log("Scanning servers I am a part of...");

    // allGuilds is all the servers this YABOB instance has joined
    const allGuilds = await Promise
        .all((await client.guilds.fetch()).map(guild => guild.fetch()));
    console.log(`Found ${allGuilds.length} server${allGuilds.length === 1 ? '' : 's'}:`);
    console.log(allGuilds.map(g => g.name));

    await Promise.all(
        allGuilds.map(guild =>
            // not sure why TS still complains, we already checked for null
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            AttendingServerV2.create(client.user!, guild, firebase_db)
                .then(server => serversV2.set(guild.id, server))
                .then(() => postSlashCommands(guild))
                .catch((err: Error) => {
                    console.error(
                        `An error occured during startup of server: `
                        + `${guild.name}.\n${err.stack}`
                    );
                })
        )
    );

    console.log("✅\x1b[32mReady to go!\x1b[0m✅\n");
    console.log("---- Begin Server Logs ----");
    return;
});

client.on("guildCreate", async guild => {
    console.log("guild create");
    await joinGuild(guild);
});

client.on("interactionCreate", async interaction => {
    // Only care about if the interaction was a command or a button
    if (!interaction.isCommand() && !interaction.isButton()) { return; }

    // Don't care about the interaction if done through dms
    if (interaction.guild === null) {
        await interaction.reply("Sorry, I dont respond to direct messages.");
        return;
    }

    const server = serversV2.get(interaction.guild.id);
    if (server === undefined) {
        console.log(`Received interaction from unknown server. Did you invite me yet?`);
        throw Error();
    }
    const mappp = new Map<string, AttendingServerV2>();
    mappp.set(interaction.guild.id, server);
    const h = new CentralCommandDispatcher(mappp);
    await h.process(interaction as CommandInteraction);


    // await server.EnsureHasRole(interaction.member as GuildMember);

    // //If the interactin is a Command
    // if (interaction.isCommand()) {
    //     await ProcessCommand(server, interaction);
    // }
    // //if the interaction is a button
    // else if (interaction.isButton()) {
    //     await ProcessButtonPress(server, interaction);
    // }
});

// updates user status of either joining a vc or leaving one
client.on("voiceStateUpdate", async (oldState, newState) => {
    if (oldState.member?.id !== newState.member?.id) {
        console.error("voiceStateUpdate: members don't match");
    }
    if (oldState.guild.id !== newState.guild.id) {
        console.error("voiceStateUpdate: servers don't match");
    }
});

client.on("guildMemberAdd", async member => {
    const server = serversV2.get(member.guild.id) ?? await joinGuild(member.guild);
    const studentRole = server.guild.roles.cache.find(role => role.name === 'Student');
    if (studentRole !== undefined) {
        await member.roles.add(studentRole);
    }
});

process.on('exit', () => {
    console.log(
        '---- End Server Log ----\n'
        + '---- Begin Error Stack Trace ----\n');
});

async function joinGuild(guild: Guild): Promise<AttendingServerV2> {
    if (client.user === null) {
        throw Error('Please wait until YABOB has logged in '
            + 'to manage the server');
    }
    console.log(`Joining guild ${guild.name}`);
    const server = await AttendingServerV2.create(client.user, guild, firebase_db);
    await postSlashCommands(guild);
    serversV2.set(guild.id, server);
    return server;
}
