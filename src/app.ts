import Collection from '@discordjs/collection';
import { Client, Guild, GuildMember, Intents, TextChannel } from 'discord.js';
import { ProcessCommand } from './command_handler';
import { AttendingServer } from './server';
import * as dotenv from 'dotenv'
import { PostSlashCommands } from './slash_commands';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as gcs_creds from '../gcs_service_account_key.json'
import * as fbs_creds from '../fbs_service_account_key.json'
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

    const db = getFirestore()
    console.log('Connected to Firebase database')

    await Promise.all(full_guilds.map(guild =>
        AttendingServer.Create(client, guild, db, attendance_doc)
            .then(server => servers.set(guild, server))
            .then(() => PostSlashCommands(guild))
            .catch((err: Error) => {
                console.error(`An error occured in processing servers during startup. ${err.stack}`)
            })
    ))

    console.log('Ready to go!')
});

async function JoinGuild(guild: Guild): Promise<AttendingServer> {
    console.log(`Joining guild ${guild.name}`)
    initializeApp({
        credential: cert(fbs_creds)
    })
    const db = getFirestore()
    const server = await AttendingServer.Create(client, guild, db)
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
        //a space separates the type of interaction and the name of the queue channel
        const pos = interaction.customId.indexOf(" ")
        const type = interaction.customId.substring(0, pos)
        const queue_name = interaction.customId.substring(pos + 1)

        if (!(interaction.member instanceof GuildMember)) {
            console.error(`Recieved an interaction without a member from user ${interaction.user} on server ${interaction.guild}`)
            return
        }

        if (type === 'join') {
            interaction.deferUpdate()
            await server.EnqueueUser(queue_name, interaction.member).catch((errstr: Error) => {
                if (interaction.member instanceof GuildMember) {
                    interaction.member.send(errstr.message)
                }
            })
        } else if (type === 'leave') {
            interaction.deferUpdate()
            await server.RemoveMemberFromQueues(interaction.member).catch((errstr: Error) => {
                if (interaction.member instanceof GuildMember && errstr.name == 'UserError') {
                    interaction.member.send(errstr.message)
                }
            })
        } else if (type === 'notif') {
            interaction.deferUpdate()
            await server.JoinNotifcations(interaction.member, queue_name).catch((errstr: Error) => {
                if (interaction.member instanceof GuildMember && errstr.name == 'UserError') {
                    interaction.member.send(errstr.message)
                }
            })
        } else {
            console.error('Received invalid button interaction')
        }
        return
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
})

//incase someone sends a message in the queue channel
client.on('messageCreate', async messsage => {

})

client.on('guildMemberAdd', async member => {
    let server = servers.get(member.guild as Guild)
    if (server === undefined) {
        server = await JoinGuild(member.guild)
    }
    await server.EnsureHasRole(member as GuildMember)
})
