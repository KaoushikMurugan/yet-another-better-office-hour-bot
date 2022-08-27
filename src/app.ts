import Collection from "@discordjs/collection";
import {
    Client,
    CommandInteraction,
    Guild,
    Intents,
} from "discord.js";

import { postSlashCommands } from "./command-handling/slash-commands";

import dotenv from "dotenv";
import gcs_creds from "../gcs_service_account_key.json";
import fbs_creds from "../fbs_service_account_key.json";

import { GoogleSpreadsheet } from "google-spreadsheet";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { AttendingServerV2 } from "./attending-server/base-attending-server";
import { CentralCommandDispatcher } from "./command-handling/centeral-handler";

dotenv.config();

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

const serversV2: Collection<Guild, AttendingServerV2> = new Collection();
const firebase_db: FirebaseFirestore.Firestore = getFirestore();

console.log("Connected to Firebase database");

client.login(process.env.YABOB_BOT_TOKEN).catch((e: Error) => {
    console.error("Login Unsuccessful. Check YABOBs credentials.");
    throw e;
});

client.on("error", error => {
    console.error(error);
});

client.on("ready", async () => {
    console.log("YABOB V3");

    if (client.user === null) {
        throw new Error(
            "Login Unsuccessful. Check YABOB's Discord Credentials"
        );
    }

    console.log(`Logged in as ${client.user.tag}!`);
    console.log("Scanning servers I am a part of...");

    // allGuilds is all the servers this YABOB instance has joined
    const allGuilds = await Promise.all((await client.guilds.fetch()).map(guild => guild.fetch()));
    console.log(`Found ${allGuilds.length} server(s)`);

    // Connecting to the attendance sheet
    let attendance_doc: GoogleSpreadsheet | null = null;
    if (process.env.YABOB_GOOGLE_SHEET_ID !== undefined) {
        attendance_doc = new GoogleSpreadsheet(
            process.env.YABOB_GOOGLE_SHEET_ID
        );
        await attendance_doc.useServiceAccountAuth(gcs_creds);
        console.log("Connected to Google sheets.");
    } else {
        console.log(
            `No google sheets ID found. Creating BOB without attendance logging.`
        );
    }

    const a = await AttendingServerV2.create(client.user, allGuilds[0]!, firebase_db);
    serversV2.set(allGuilds[0]!, a);
    return;
    serversV2.set(allGuilds[0]!, a);


    // return;
    // // process.exit(0);
    await Promise.all(
        allGuilds.map(guild =>
            // not sure why TS still complains, we already checked for null
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            AttendingServerV2.create(client.user!, guild, firebase_db)
                .then(server => serversV2.set(guild, server))
                .then(() => postSlashCommands(guild))
                .catch((err: Error) => {
                    console.error(
                        `An error occured in processing servers during startup of server: `
                        + `${guild.name}. ${err.stack}`
                    );
                })
        )
    );

    console.log("Ready to go!");
    console.log(allGuilds.map(guild => guild.name));

    // await Promise.all(
    //     full_guilds.map(async guild => {
    //         const server = servers.get(guild);
    //         if (server !== undefined) {
    //             await server.AutoScheduleUpdates(server);
    //         }
    //     })
    // );
});

client.on("guildCreate", async guild => {
    await joinGuild(guild);
});

client.on("interactionCreate", async interaction => {
    console.log("interaction create");

    // Only care about if the interaction was a command or a button
    if (!interaction.isCommand() && !interaction.isButton()) return;

    // Don't care about the interaction if done through dms
    if (interaction.guild === null) {
        await interaction.reply("Sorry, I dont respond to direct messages.");
        return;
    }

    const server = serversV2.get(interaction.guild);
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

    // const server =
    //     serversv2.get(oldState.guild) ?? (await joinGuild(oldState.guild));
    // const member = oldState.member;
    // await server.EnsureHasRole(member as GuildMember);

    // // if a user joins a vc
    // if (oldState.channel === null && newState.channel !== null) {
    //     // if not a helper, mark as being helped
    //     server.UpdateMemberJoinedVC(member as GuildMember);
    // }

    // // if a user leaves a vc
    // if (oldState.channel !== null && newState.channel === null) {
    //     // if not a helper and marked as being helped
    //     // send the person who left vc a dm to fill out a form
    //     // mark as not currently being helped
    //     await server.UpdateMemberLeftVC(member as GuildMember);
    // }
});

// incase queue message gets deleted
client.on("messageDelete", async message => {
    if (message === null || message?.member === null) {
        console.error("Recognized a message deletion without a message");
        return;
    }
    if (message.author?.id !== process.env.YABOB_APP_ID) {
        return;
    }
    if (message.guild === null) {
        console.error("Recognized a message deletion without a guild");
        return;
    }

    const server = serversV2.get(message.guild);

    if (server === undefined) {
        // Calling JoinGuild() here causes issues involving duplicate of the
        // same server being stored in fullGuilds
        return;
    }

    // await server.EnsureHasRole(message.member as GuildMember);

    // const channel = message.channel as TextChannel;
    // const category = channel.parent;

    // if (category === null) {
    //     return;
    // }

    // await server.EnsureQueueSafe(category.name);
    // await server.ForceQueueUpdate(category.name);
});

client.on("guildMemberAdd", async member => {
    // const server = serversv2.get(member.guild) ?? await joinGuild(member.guild);
    // await server.EnsureHasRole(member as GuildMember);
});

async function joinGuild(guild: Guild): Promise<AttendingServerV2> {
    if (client.user === null) {
        throw Error('Please wait until YABOB has logged in '
            + 'to manage the server');
    }
    console.log(`Joining guild ${guild.name}`);

    const server = await AttendingServerV2.create(client.user, guild, firebase_db);
    await postSlashCommands(guild);
    console.log(guild.name);
    serversV2.set(guild, server);
    return server;
}
