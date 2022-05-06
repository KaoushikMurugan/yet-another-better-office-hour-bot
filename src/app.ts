import Collection from '@discordjs/collection';
import { Client, Guild, GuildMember, Intents } from 'discord.js';
import { ProcessCommand } from './command_handler';
import { AttendingServer } from './server';
import * as dotenv from 'dotenv'
import { PostSlashCommands } from './slash_commands';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as gcs_creds from '../gcs_service_account_key.json'
import { SlashCommandRoleOption } from '@discordjs/builders';
import { HelpQueue } from './queue';

dotenv.config()

if(process.env.BOB_BOT_TOKEN === undefined || process.env.BOB_APP_ID === undefined) {
    console.error('Missing token or id!')
    process.exit(1)
}

const client = new Client({ intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_INVITES,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_PRESENCES,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES,
]})

const servers: Collection<Guild, AttendingServer> = new Collection()

void client.login(process.env.BOB_BOT_TOKEN)

client.on('error', (error) => {
    console.error(error)
})

client.on('ready', async () => {
    console.log('B.O.B. V1.0')
    if(client.user !== null) {
        console.log(`Logged in as ${client.user.tag}!`);
    }
    console.log('Scanning servers I am a part of...')
    const guilds = await client.guilds.fetch()
    console.log(`Found ${guilds.size} server(s)`)
    const full_guilds = await Promise.all(guilds.map(guild => guild.fetch()))
    
    let attendance_doc: GoogleSpreadsheet | null = null
    if(process.env.BOB_GOOGLE_SHEET_ID !== undefined) {
        attendance_doc = new GoogleSpreadsheet(process.env.BOB_GOOGLE_SHEET_ID)
        await attendance_doc.useServiceAccountAuth(gcs_creds)
        console.log('Connected to Google sheets.')
    }

    await Promise.all(full_guilds.map(guild =>
        AttendingServer.Create(client, guild, attendance_doc)
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
    const server = await AttendingServer.Create(client, guild)
    await PostSlashCommands(guild)
    servers.set(guild, server)
    return server
}

client.on('guildCreate', async guild => {
    await JoinGuild(guild)
})

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isButton()) return;
    if (interaction.guild === null) {
        await interaction.reply('Sorry, I dont respond to direct messages.')
        return
    }

    let server = servers.get(interaction.guild as Guild)
    if(server === undefined) {
        server = await JoinGuild(interaction.guild)
    }
    await server.EnsureHasRole(interaction.member as GuildMember)
    if(interaction.isCommand()) {
        await ProcessCommand(server, interaction)
    }
    else if(interaction.isButton()) {
        //a space separates the type of interaction and the name of the queue channel
        const type = interaction.customId.split(" ")[0]
        const queue_name = interaction.customId.split(" ")[1]

        if(!(interaction.member instanceof GuildMember)) {
            interaction.deferUpdate()
            await interaction.reply({content: `Erm. Somethings wrong, this shouldn't happen. I'll inform the humaniod that maintains me`, ephemeral: true})
            console.error(`Recieved an interaction without a member from user ${interaction.user} on server ${interaction.guild}`)
            return;
        }

        if(type === 'join') {
            await server.EnqueueUser(queue_name, interaction.member).catch((errstr : Error) => {
                if(interaction.member instanceof GuildMember) {
                    interaction.member.send(errstr.message)
                }
            })
        } else if(type === 'leave') {
            interaction.deferUpdate()
             await server.RemoveMemberFromQueues(interaction.member).catch((errstr : Error) => {
                if(interaction.member instanceof GuildMember && errstr.name == 'UserError') {
                    interaction.member.send(errstr.message)
                }
             })
        } else {
            console.error('Received invalid button interaction')
        }
        return
    }
});

client.on('guildMemberAdd', async member => {
    let server = servers.get(member.guild as Guild)
    if(server === undefined) {
        server = await JoinGuild(member.guild)
    }
    await server.EnsureHasRole(member as GuildMember)
})
