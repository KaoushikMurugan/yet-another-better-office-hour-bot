import Collection from '@discordjs/collection';
import { Client, Guild, GuildMember, Intents, TextChannel } from 'discord.js';
import { ProcessCommand } from './command_handler';
import { AttendingServer } from './server';
import * as dotenv from 'dotenv'
import { PostSlashCommands } from './slash_commands';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as gcs_creds from '../gcs_service_account_key.json'
import * as fbs_creds from '../fbs_service_account_key.json'
import { ProcessButtonPress } from './button_handler';
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

dotenv.config()

if (process.env.BOB_BOT_TOKEN === undefined || process.env.BOB_APP_ID === undefined) {
    console.error('Missing token or id!')
    process.exit(1)
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
    ]
})

const servers: Collection<Guild, AttendingServer> = new Collection()

var firebase_db: any = null

void client.login(process.env.BOB_BOT_TOKEN)

client.on('error', (error) => {
    console.error(error)
})

client.on('ready', async () => {
    console.log('B.O.B. V2.1')
    if (client.user !== null) {
        console.log(`Logged in as ${client.user.tag}!`);
    }
    console.log('Scanning servers I am a part of...')
    const guilds = await client.guilds.fetch()
    console.log(`Found ${guilds.size} server(s)`)
    const full_guilds = await Promise.all(guilds.map(guild => guild.fetch()))

    //Connecting to the attendance sheet
    let attendance_doc: GoogleSpreadsheet | null = null
    if (process.env.BOB_GOOGLE_SHEET_ID !== undefined) {
        attendance_doc = new GoogleSpreadsheet(process.env.BOB_GOOGLE_SHEET_ID)
        await attendance_doc.useServiceAccountAuth(gcs_creds)
        console.log('Connected to Google sheets.')
    }

    //Connect to the firebase database
    initializeApp({
        credential: cert(fbs_creds)
    })

    firebase_db = getFirestore()
    console.log('Connected to Firebase database')

    let minDate = new Date()
    let maxDate = new Date()
    maxDate.setDate(minDate.getDate() + 14)

    await Promise.all(full_guilds.map(guild =>
        AttendingServer.Create(client, guild, firebase_db, attendance_doc)
            .then(server => servers.set(guild, server))
            .then(() => PostSlashCommands(guild))
            .catch((err: Error) => {
                console.error(`An error occured in processing servers during startup. ${err.stack}`)
            })
    ))
    console.log('Ready to go!')
    /*Promise.all(full_guilds.map(guild => {
        servers.get(guild)?.ProcessForever()
    }))*/
});

async function JoinGuild(guild: Guild): Promise<AttendingServer> {
    console.log(`Joining guild ${guild.name}`)
    if (firebase_db === null) {
        initializeApp({
            credential: cert(fbs_creds)
        })
        firebase_db = getFirestore()
    }
    const server = await AttendingServer.Create(client, guild, firebase_db)
    await PostSlashCommands(guild)
    servers.set(guild, server)
    return server
}

client.on('guildCreate', async guild => {
    await JoinGuild(guild)
})

client.on('interactionCreate', async interaction => {
    //Only care about if the interaction was a command or a button
    if (!interaction.isCommand() && !interaction.isButton()) return;

    //Don't care about the interaction if done through dms
    if (interaction.guild === null) {
        await interaction.reply('Sorry, I dont respond to direct messages.')
        return
    }

    let server = servers.get(interaction.guild as Guild)
    if (server === undefined) {
        server = await JoinGuild(interaction.guild)
    }

    await server.EnsureHasRole(interaction.member as GuildMember)

    //If the interactin is a Command
    if (interaction.isCommand()) {
        await ProcessCommand(server, interaction)
    }
    //if the interaction is a button
    else if (interaction.isButton()) {
        await ProcessButtonPress(server, interaction)
    }
});

// updates user status of either joining a vc or leaving one
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (oldState.member?.id !== newState.member?.id)
        console.error('voiceStateUpdate: members don\'t match')

    let member = oldState.member

    if (oldState.guild.id !== newState.guild.id)
        console.error('voiceStateUpdate: servers don\'t match')

    let server = servers.get(oldState.guild as Guild)

    if (server === undefined) {
        server = await JoinGuild(oldState.guild)
    }
    await server.EnsureHasRole(member as GuildMember)

    // if a user joins a vc
    if (oldState.channel === null && newState.channel !== null) {
        // if not a helper, mark as being helped
        await server.UpdateMemberJoinedVC(member as GuildMember)
    }

    // if a user leaves a vc

    if (oldState.channel !== null && newState.channel === null) {
        // if not a helper and marked as being helped
        // send the person who left vc a dm to fill out a form
        // mark as not currently being helped

        await server.UpdateMemberLeftVC(member as GuildMember)
    }
})

//incase queue message gets deleted
client.on('messageDelete', async message => {
    if (message === null) {
        console.error("Recognized a message deletion without a message")
        return
    }
    if (message.author?.id !== process.env.BOB_APP_ID) {
        return
    }
    if (message.guild === null) {
        console.error("Recognized a message deletion without a guild")
        return
    }
    let server = servers.get(message.guild as Guild)
    if (server === undefined) {
        server = await JoinGuild(message.guild)
    }
    await server.EnsureHasRole(message.member as GuildMember)
    const channel = message.channel as TextChannel
    const category = channel.parent
    if (category === null)
        return
    await server.EnsureQueueSafe(category.name)
    await server.ForceQueueUpdate(category.name)
})

client.on('guildMemberAdd', async member => {
    let server = servers.get(member.guild as Guild)
    if (server === undefined) {
        server = await JoinGuild(member.guild)
    }
    await server.EnsureHasRole(member as GuildMember)
})
