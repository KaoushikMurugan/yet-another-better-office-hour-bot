import { CategoryChannel, CommandInteraction, GuildChannel, GuildMember } from "discord.js";
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
            throw new UserError(`The subcommand ${subcommand} is not valid`)
        }
    }
}

class EnqueueCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const channel = interaction.options.getChannel('queue_name', true)
        const user = interaction.options.getMember('user')

        // Workaround for discord bug https://bugs.discord.com/T2703
        // Ensure that a user does not invoke this command with a channel they cannot view.
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
            if (admin_role === undefined) {
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
        if (user_option !== null && queue_option !== null) {
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
        await helpee.member.send(`It's your turn! Join the call: ${invite.toString()}`).then(() => { invite_sent = true })
        if (invite_sent) {
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
        const mute_notif_option = (interaction.options.getBoolean('mute_notif') === true) //if null, then set to false
        await server.AddHelper(interaction.member as GuildMember, mute_notif_option)
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
        if (queue_count == 0) {
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

class AnnounceCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.STAFF
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const message_option = interaction.options.getString('message')
        if (message_option === null) {
            throw new UserError('You must provide a message.')
        }

        const queue_option = interaction.options.getChannel('queue_name')
        const response = await server.Announce(queue_option as GuildChannel | null, message_option, interaction.member as GuildMember)
        await interaction.editReply(response)
    }
}

class ListHelpersCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const helpers = server.GetHelpingMemberStates()
        if (helpers.size === 0) {
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

class ListNextHoursCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const queue_option = interaction.options.getChannel('queue_name')
        // Get all the members of the tutors for this course
        if (queue_option === null) {
            throw new UserError("Invalid queue name")
        }

        let response = await server.getUpcomingHoursTable(queue_option.name)
        await interaction.editReply(response)
    }
}

class GetNotifcationsHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const channel = interaction.options.getChannel('queue_name', true)

        // Workaround for discord bug https://bugs.discord.com/T2703
        // Ensure that a user does not invoke this command with a channel they cannot view.
        if (channel.type === 'GUILD_CATEGORY') {
            const unviewable_channel = (channel as CategoryChannel).children
                .find(child => !child.permissionsFor(interaction.member as GuildMember).has('VIEW_CHANNEL'))
            if (unviewable_channel !== undefined) {
                throw new UserError(`You do not have access to ${channel.name}`)
            }
        }

        await server.JoinNotifications(channel.name, interaction.member as GuildMember)
        const response = "You will be notified once the `" + channel.name + "` queue becomes open"
        await interaction.editReply(response)
    }
}

class RemoveNotifcationsHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const channel = interaction.options.getChannel('queue_name', true)

        // Workaround for discord bug https://bugs.discord.com/T2703
        // Ensure that a user does not invoke this command with a channel they cannot view.
        if (channel.type === 'GUILD_CATEGORY') {
            const unviewable_channel = (channel as CategoryChannel).children
                .find(child => !child.permissionsFor(interaction.member as GuildMember).has('VIEW_CHANNEL'))
            if (unviewable_channel !== undefined) {
                throw new UserError(`You do not have access to ${channel.name}`)
            }
        }

        await server.RemoveNotifications(channel.name, interaction.member as GuildMember)
        const response = "You will no longer be notified once the `" + channel.name + "` queue becomes open"
        await interaction.editReply(response)
    }
}

class MsgAfterLeaveVCHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ADMIN
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const subcommand = interaction.options.getSubcommand()
        if (subcommand === 'edit') {
            const change_message_option = interaction.options.getBoolean('change_message')
            const enable_option = interaction.options.getBoolean('enable')
            if (enable_option === null) {
                throw new UserError('You must provide a value for the enable option.')
            }
            if (interaction === null || interaction.channel === null) {
                return
            } else if (!interaction.channel.isText()) {
                return
            }
            let dmMessage: string | null = server.getMsgAfterLeaveVC()
            if (change_message_option === true) {
                await interaction.channel.messages.fetch({ limit: 1 }).then(messages => {
                    let lastMessage = messages.first();
                    if (lastMessage == undefined)
                        return
                    if (lastMessage.author.id === interaction.member?.user.id) {
                        dmMessage = lastMessage.content
                    }
                })
            }
            let response = await server.EditDmMessage(dmMessage, enable_option)
            await interaction.editReply(response)

        } else if (subcommand === 'revert') {
            let response = await server.RevertDmMessage()
            await interaction.editReply(response)
        } else {
            throw new UserError(`The subcommand ${subcommand} is not valid`)
        }

    }
}

class SetCalendarHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ADMIN
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const subcommand = interaction.options.getSubcommand()
        if (subcommand === 'set_calendar') {
            let calendar_link = interaction.options.getString('calendar_link')
            if (calendar_link === null) {
                throw new UserError('You must provide a string for calendar_link.')
            }
            if (interaction === null || interaction.channel === null) {
                return
            } else if (!interaction.channel.isText()) {
                return
            }

            //https://calendar.google.com/calendar/embed?src=[calendar_id]&[otherstuff]

            let header: string = "https://calendar.google.com/calendar/embed?src="
            calendar_link = calendar_link.split('&')[0]
            const posHeader = calendar_link.indexOf(header)
            if (posHeader === 0) {
                const calendar_id = calendar_link.substring(header.length)
                let response = await server.setTutorCalendar(calendar_id)
                await interaction.editReply(response)
            } else {
                await interaction.editReply("Link is invalid")
            }

        } else if (subcommand === 'set_sheets') {
            const sheets_link = interaction.options.getString('sheets_link')
            if (sheets_link === null) {
                throw new UserError('You must provide a string for sheets_link.')
            }
            if (interaction === null || interaction.channel === null) {
                return
            } else if (!interaction.channel.isText()) {
                return
            }

            //https://docs.google.com/spreadsheets/d/[doc_id]/edit#gid=[sheet_id]
            //find substring/pos after 'https://docs.google.com/spreadsheets/d/'
            //split by /edit#gid=

            let header: string = "https://docs.google.com/spreadsheets/d/"
            let gidSep: string = "/edit#gid="
            const posHeader = sheets_link.indexOf(header)
            const posGidSep = sheets_link.indexOf(gidSep)
            if (posHeader === 0 && posGidSep > header.length) {
                const doc_id = sheets_link.substring(header.length, posGidSep)
                const sheets_id = sheets_link.substring(posGidSep + gidSep.length)
                let response = await server.setTutorSheets(doc_id, sheets_id)
                await interaction.editReply(response)
            } else {
                await interaction.editReply("Link is invalid")
            }
        } else if (subcommand === 'format_help') {
            await interaction.editReply("This command is being worked on. For the time being, please contact the developers of the bot for assitence on how to connect the bot with a calendar and sheets")
        } else {
            throw new UserError(`The subcommand ${subcommand} is not valid`)
        }

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
    ['announce', new AnnounceCommandHandler()],
    ['list_helpers', new ListHelpersCommandHandler()],
    ['when_next', new ListNextHoursCommandHandler()],
    ['notify_me', new GetNotifcationsHandler()],
    ['remove_notif', new RemoveNotifcationsHandler()],
    ['post_session_msg', new MsgAfterLeaveVCHandler()],
    ['calendar', new SetCalendarHandler()]
])

export async function ProcessCommand(server: AttendingServer, interaction: CommandInteraction): Promise<void> {
    try {
        const handler = handlers.get(interaction.commandName)
        if (handler === undefined) {
            await interaction.reply({ content: `The command "${interaction.commandName}" is unrecognized.`, ephemeral: true })
            console.error(`Recieved an unknown slash-command "${interaction.commandName}" from user "${interaction.user.username}" on server "${interaction.guild?.name}"`)
            return;
        }

        if (!(interaction.member instanceof GuildMember)) {
            await interaction.reply({ content: `Erm. Somethings wrong, this shouldn't happen. I'll inform the humaniod that maintains me`, ephemeral: true })
            console.error(`Recieved an interaction without a member from user ${interaction.user} on server ${interaction.guild}`)
            return;
        }
        const admin_role = interaction.member.roles.cache.find(role => role.name == 'Admin')
        const staff_role = interaction.member.roles.cache.find(role => role.name == 'Staff')

        if ((handler.permission == CommandAccessLevel.ADMIN && admin_role === undefined) ||
            (handler.permission == CommandAccessLevel.STAFF && staff_role == undefined)) {
            await interaction.reply({ content: `No can do. You don't have access to this command.`, ephemeral: true })
            return;
        }

        await interaction.deferReply({ ephemeral: true })
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
    } catch (err) {
        console.error(`An error occurred during command processing: ${err}`)
    }
}