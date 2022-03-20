import { CategoryChannel, CommandInteraction, GuildChannel, GuildMember }  from "discord.js";
import { AttendingServer } from "./server";
import { UserError } from "./user_action_error";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsciiTable = require('ascii-table');

enum CommandAccessLevel {
    ANYONE, STAFF, ADMIN
}
interface CommandHandler {
    readonly permission: CommandAccessLevel
    Process(server: AttendingServer, interaction: CommandInteraction): Promise<void>
}

class QueueCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ADMIN
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const subcommand = interaction.options.getSubcommand()
        if (subcommand === 'add') {
            const name = interaction.options.getString('queue_name', true)
            await server.CreateQueue(name)
            await interaction.editReply(`Created queue "${name}"`)
        } else if (subcommand === 'remove') {
            const channel = interaction.options.getChannel('queue_name', true)
            await server.RemoveQueue(channel as GuildChannel)
            await interaction.editReply(`Removed queue "${channel.name}"`)
        } else {
            throw new UserError(`The subcommand ${subcommand}`)
        }
    }
}

class EnqueueCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const channel = interaction.options.getChannel('queue_name', true)
        const user = interaction.options.getMember('user')

        // Workaround for discord bug https://bugs.discord.com/T2703
        // Ensure that a user does not invoke this command with a channel they canot view.
        if (channel.type === 'GUILD_CATEGORY') {
            const unviewable_channel = (channel as CategoryChannel).children
                .find(child => !child.permissionsFor(interaction.member as GuildMember).has('VIEW_CHANNEL'))
            if (unviewable_channel !== undefined) {
                throw new UserError(`You do not have access to ${channel.name}`)
            }
        }

        if (user instanceof GuildMember) {
            // Sort of a hack, do a permission check for the user option
            const admin_role = (interaction.member as GuildMember).roles.cache.find(role => role.name == 'Admin')
            if(admin_role === undefined) {
                await interaction.editReply(`No can do. You don't have access to this command.`)
            } else {
                await server.EnqueueUser(channel.name, user)
                await interaction.editReply(`<@${user.id}> has been added to "${channel.name}"`)
            }
        } else {
            await server.EnqueueUser(channel.name, interaction.member as GuildMember)
            await interaction.editReply(`You have been added to the ${channel.name} queue.`)
        }
    }
}

class DequeueCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.STAFF
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const queue_option = interaction.options.getChannel('queue_name')
        const user_option = interaction.options.getUser('user')
        if(user_option !== null && queue_option !== null) {
            throw new UserError('Either "queue_name" or "user" can be provided, not both.')
        }

        if (queue_option !== null && queue_option.type != 'GUILD_CATEGORY') {
            throw new UserError(`${queue_option.name} is not a queue.`)
        }

        const helper = interaction.member as GuildMember
        if (helper.voice.channel === null || helper.voice.channel.type != 'GUILD_VOICE') {
            throw new UserError('You need to be connected to a voice channel.')
        }
        
        // Clear any previously set permissions
        await Promise.all(
            helper.voice.channel.permissionOverwrites.cache
                .filter(overwrite => overwrite.type == 'member')
                .map(overwrite => overwrite.delete()
            ))
        const helpee = await server.Dequeue(helper, queue_option as CategoryChannel | null, user_option)
        await helper.voice.channel.permissionOverwrites.create(helpee.member, {
            VIEW_CHANNEL: true,
            CONNECT: true
        })
        const invite = await helper.voice.channel.createInvite()
        let invite_sent = false
        await helpee.member.send(`It's your turn! Join the call: ${invite.toString()}`).then(() => {invite_sent = true})
        if(invite_sent) {
            await interaction.editReply(`<@${helpee.member.user.id}> was sent an invite to your voice channel.`)
        } else {
            console.error(`Could not send a message to ${helpee.member.user.username}.`)
            await interaction.editReply(`I could not send <@${helpee.member.user.id}> an invite to your voice channel. Can you try to get in touch with them?`)
        }
    }
}

class StartCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.STAFF
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        await server.AddHelper(interaction.member as GuildMember)
        await interaction.editReply('You have started helping. Have fun!')
    }
}

class StopCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.STAFF
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const help_time = await server.RemoveHelper(interaction.member as GuildMember)
        await interaction.editReply(`You helped for ${help_time / 60000} minutes. See you later!`)
    }
}

class LeaveCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const queue_count = await server.RemoveMemberFromQueues(interaction.member as GuildMember)
        if(queue_count == 0) {
            await interaction.editReply('You are not in any queues')
        } else {
            await interaction.editReply(`You have been removed from the queue(s)`)
        }
    }
}

class ClearCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.STAFF
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const channel_option = interaction.options.getChannel('queue_name')
        const all_option = interaction.options.getBoolean('all')

        if (all_option === true) {
            await server.ClearAllQueues()
            await interaction.editReply('All queues have been cleared.')
        } else if (channel_option instanceof GuildChannel) {
            if (channel_option.type != 'GUILD_CATEGORY') {
                throw new UserError(`${channel_option.name} is not a queue.`)
            }
            await server.ClearQueue(channel_option as CategoryChannel)
            await interaction.editReply(`"${channel_option.name}" has been cleared.`)
        } else {
            throw new UserError('Either "all" or "queue_name" must be provided')
        }
    }
}

class ListHelpersCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const helpers = server.GetHelpingMemberStates()
        if(helpers.size === 0) {
            await interaction.editReply('No one is helping right now.')
            return
        }

        const table = new AsciiTable()
        table.setHeading('Staff Member', 'Queues', 'Time online')


        helpers.forEach((queues, helper) => {
            const name = helper.member.nickname !== null ? helper.member.nickname : helper.member.user.username
            const help_time = helper.GetHelpTime()
            const mins = String(Math.round(help_time / 60000)).padStart(2, '0')
            const secs = String(Math.round((help_time % 60000) / 1000)).padStart(2, '0')
            table.addRow(name, queues.join(', '), `${mins}:${secs}`)
        })

        await interaction.editReply('```' + table.toString() + '```')
    }
}


const handlers = new Map<string, CommandHandler>([
    ['queue', new QueueCommandHandler()],
    ['enqueue', new EnqueueCommandHandler()],
    ['next', new DequeueCommandHandler()],
    ['start', new StartCommandHandler()],
    ['stop', new StopCommandHandler()],
    ['leave', new LeaveCommandHandler()],
    ['clear', new ClearCommandHandler()],
    ['list_helpers', new ListHelpersCommandHandler()],
])

export async function ProcessCommand(server: AttendingServer, interaction: CommandInteraction): Promise<void> {
    try {
        const handler = handlers.get(interaction.commandName)
        if (handler === undefined) {
            await interaction.reply({content: `The command "${interaction.commandName}" is unrecognized.`, ephemeral: true})
            console.error(`Recieved an unknown slash-command "${interaction.commandName}" from user "${interaction.user.username}" on server "${interaction.guild?.name}"`)
            return;
        }

        if(!(interaction.member instanceof GuildMember)) {
            await interaction.reply({content: `Erm. Somethings wrong, this shouldn't happen. I'll inform the humaniod that maintains me`, ephemeral: true})
            console.error(`Recieved an interaction without a member from user ${interaction.user} on server ${interaction.guild}`)
            return;
        }
        const admin_role = interaction.member.roles.cache.find(role => role.name == 'Admin')
        const staff_role = interaction.member.roles.cache.find(role => role.name == 'Staff')

        if ((handler.permission == CommandAccessLevel.ADMIN && admin_role === undefined) ||
            (handler.permission == CommandAccessLevel.STAFF && staff_role == undefined)) {
            await interaction.reply({content: `No can do. You don't have access to this command.`, ephemeral: true})
            return;
        }
    
            await interaction.deferReply({ephemeral: true})
            await handler.Process(server, interaction).catch((err: Error) => {
                if (err.name == 'UserError') {
                    return interaction.editReply(err.message)
                } else {
                    console.error(`Encountered an internal error when processing "${interaction.commandName}" for user "${interaction.user.username}" on server "${interaction.guild?.name}": "${err.stack}"`)
                    return interaction.editReply('Oh noez! I ran into an internal error.')
                }
        }).catch((err) => {
            console.error(`An error occurred during error handling: ${err}`)
        })
    } catch(err) {
        console.error(`An error occurred during command processing: ${err}`)
    }
}