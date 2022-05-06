import { CategoryChannel, Client, Guild, GuildChannel, Role, TextChannel, User, Collection, GuildMember } from "discord.js";
import { HelpQueue, HelpQueueDisplayManager } from "./queue";
import { MemberStateManager } from "./member_state_manager";
import { UserError } from "./user_action_error";
import { MemberState } from "./member_state_manager";
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";

/**************************************************************
 * This file implements the AttendingServer class
 * defines an instance of a server which the bot is connected to
 * implements various functions used by app.ts and 
 * command_handler.ts
 **************************************************************/

export class AttendingServer {
    private queues: HelpQueue[] = []
    private member_states: MemberStateManager
    private client: Client
    private server: Guild
    private attendance_doc: GoogleSpreadsheet | null
    private attendance_sheet: GoogleSpreadsheetWorksheet | null = null

    private constructor(client: Client, server: Guild, attendance_doc: GoogleSpreadsheet | null) {
        this.client = client
        this.server = server
        this.member_states = new MemberStateManager()
        this.attendance_doc = attendance_doc
    }

    static async Create(client: Client, server: Guild, attendance_doc: GoogleSpreadsheet | null = null): Promise<AttendingServer> {
        if (server.me === null || !server.me.permissions.has("ADMINISTRATOR")) {
            await server.fetchOwner().then(owner =>
                owner.send(`Sorry. I need full administrator permission to join and manage "${server.name}"`))
            await server.leave()
            throw new UserError('Invalid permissions.')
        }
        const me = new AttendingServer(client, server, attendance_doc)
        await me.DiscoverQueues()
        await me.UpdateRoles()
        await Promise.all(me.queues.map(queue => queue.UpdateDisplay()))
        await server.members.fetch().then(members => members.map(member => me.EnsureHasRole(member)))
        return me
    }

    // /clear all
    async ClearAllQueues(): Promise<void> {
        await Promise.all(this.queues.map(queue => queue.Clear()))
    }

    // /clear queue_name
    async ClearQueue(channel: CategoryChannel): Promise<void> {
        const queue = this.queues.find(queue => queue.name == channel.name)
        if (queue === undefined) {
            throw new UserError(`There is not a queue with the name ${channel.name}.`)
        }
        await queue.Clear()
    }

    // Return a list of the queues a member can help
    private GetHelpableQueues(member: GuildMember) {
        return this.queues.filter(queue =>
            member.roles.cache.find(role => role.name == queue.name) !== undefined)
    }

    // Removes the caller from all the Queues
    async RemoveMemberFromQueues(member: GuildMember): Promise<number> {
        let queue_count = 0
        await Promise.all(this.queues.map(queue => {
            if (queue.Has(member)) {
                queue_count++
                return queue.Remove(member)
            }
        }))
        return queue_count
    }

    // Removes the caller from the queue "queue_name"
    async RemoveMember(queue_name: string, member: GuildMember): Promise<void> {
        const queue = this.queues.find(queue => queue.name == queue_name)
        if (queue === undefined) {
            throw new UserError(`There is not a queue with the name ${queue_name}`)
        }
        await queue.Remove(member)
    }

    // consequence of /start, adds member (the caller of /start) to list of currently helping helpers for each queue
    async AddHelper(member: GuildMember): Promise<void> {
        const helpable_queues = this.GetHelpableQueues(member)
        if (helpable_queues.length == 0) {
            throw new UserError('You are a staff member but do not have any queue roles assigned. I don\'t know where you are allowed to help :(')
        }
        this.member_states.GetMemberState(member).StartHelping()
        await Promise.all(this.GetHelpableQueues(member).map(queue => queue.AddHelper(member)))
    }

    // consequence of /stop, stores the log of member onto the Attendance Sheet
    private async UpdateAttendanceLog(member: GuildMember, start_time: number): Promise<void> {
        if (this.attendance_doc === null) {
            return
        }
        // Make sure there is an attendance sheet
        if (this.attendance_sheet === null) {
            await this.attendance_doc.loadInfo()
            //find the sheet whose name is the same as the server's name
            for (let i = 0; i < this.attendance_doc.sheetCount; i++) {
                const current_sheet = this.attendance_doc.sheetsByIndex[i]
                if (current_sheet.title == this.server.name) {
                    this.attendance_sheet = current_sheet
                }
            }
            // if sheet doesn't exist for the discord server already, make a new one
            // name of the sheet should be the same as the name of the discord server
            // table headers are "username | time in | time out | helped students"
            if (this.attendance_sheet === null) {
                this.attendance_sheet = await this.attendance_doc.addSheet({ 'title': this.server.name, 'headerValues': ['username', 'time in', 'time out', 'helped students'] })
            }
        }
        // Update with this info
        // set the starting time
        const start = new Date(start_time)
        const start_time_str = `${start.toLocaleDateString()} ${start.toLocaleTimeString()}`
        // get the ending time
        const end = new Date(Date.now())
        const end_time_str = `${end.toLocaleDateString()} ${end.toLocaleTimeString()}`
        // get the list of helped students
        const helped_students = JSON.stringify(this.member_states.GetMemberState(member).members_helped.map(member => new Object({ nick: member.nickname, username: member.user.username })))
        // add new row to the sheet
        await this.attendance_sheet.addRow({ 'username': member.user.username, 'time in': start_time_str, 'time out': end_time_str, 'helped students': helped_students })
    }
    // consequence of /stop, removes "member" from the list of avaiable helpers
    async RemoveHelper(member: GuildMember): Promise<number> {
        // Remove a helper and return the time they spent helping in ms
        await Promise.all(this.GetHelpableQueues(member).map(queue => queue.RemoveHelper(member)))
        const start_time = this.member_states.GetMemberState(member).StopHelping()
        // Update the attendance log in the background
        void this.UpdateAttendanceLog(member, start_time).catch(err => {
            console.error(`Failed to update the attendance log for ${member.user.username} who helped for ${Math.round((Date.now() - start_time) / 60000)} mins`)
            console.error(`Error: ${err}`)
        })
        return Date.now() - start_time
    }

    // /next
    async Dequeue(helper: GuildMember, queue_option: CategoryChannel | null = null, user_option: User | GuildMember | null = null): Promise<MemberState> {
        // Get the next member for a helper to assist
        if (!this.member_states.GetMemberState(helper).is_helping) {
            throw new UserError('You haven\'t started helping yet. Try sending "/start" first.')
        }

        const helpable_queues = this.GetHelpableQueues(helper)
        if (helpable_queues.length == 0) {
            throw new UserError('You are not registered as a helper for any queues.')
        }
        // if user entered a particular user to dequeue
        if (user_option !== null) {
            const member = user_option instanceof User ? await this.server.members.fetch(user_option) : user_option
            const member_state = this.member_states.GetMemberState(member)
            const member_queue = member_state.queue
            if (member_queue === null) {
                throw new UserError(`<@${member.id}> is not in a queue.`)
            } else if (!helpable_queues.includes(member_queue)) {
                throw new UserError(`You are not registered as a helper for "${member_queue.name}" which <@${member.id}> is in.`)
            }
            await this.RemoveMemberFromQueues(member)
            this.member_states.GetMemberState(helper).OnDequeue(member)
            member_state.SetUpNext(true)
            return member_state
        }
        // if user entered a particular queue to remove from
        let target_queue: HelpQueue
        if (queue_option !== null) {
            const queue = this.queues.find(queue => queue.name == queue_option.name)
            if (queue === undefined) {
                throw new UserError(`There is not a queue with the name ${queue_option.name}`)
            }
            if (!helpable_queues.includes(queue)) {
                throw new UserError(`You are not registered as a helper for ${queue.name}`)
            }
            target_queue = queue
        } else { // if no options were added, dequeue the person who has been waiting the longest
            const wait_times = helpable_queues.map(queue => queue.Peek()).map(state => state === undefined ? -Infinity : state.GetWaitTime())
            const index_of_max = wait_times.indexOf(Math.max(...wait_times))
            target_queue = helpable_queues[index_of_max]
        }
        // if there's no-one to dequeue
        if (target_queue.length == 0) {
            throw new UserError('There is no one left to help. Now might be a good time for a coffee.')
        }
        const target_member_state = await target_queue.Dequeue()
        this.member_states.GetMemberState(helper).OnDequeue(target_member_state.member)
        target_member_state.SetUpNext(true)
        return target_member_state
    }

    // /announce
    async Announce(queue_option: GuildChannel | null, message: string, author: GuildMember): Promise<string> {
        const queue_name = queue_option !== null ? queue_option.name : null

        // If a queue name is specified, check that a queue with that name exists
        if (queue_name !== null) {
            const queue = this.queues.find(queue => queue.name == queue_name)
            if (queue === undefined) {
                throw new UserError(`There is not a queue with the name ${queue_name}`)
            }
        }

        // Find the members to announce to
        const targets: GuildMember[] = []
        this.member_states.forEach(member_state => {
            // If the user is not in a queue, don't announce to them
            if (member_state.queue === null)
                return

            if (queue_name !== null) {
                if (member_state.queue.name == queue_name) {
                    targets.push(member_state.member)
                }
            } else {
                targets.push(member_state.member)
            }
        })

        // Send the message in dm of each person in the queue 
        const message_string = `<@${author.id}> says: ${message}`
        const failed_targets: GuildMember[] = []
        await Promise.all(
            targets.map(target => target.send(message_string).catch(() => {
                failed_targets.push(target)
            }
            )))

        // Report any failures to the message author
        if (failed_targets.length > 0) {
            const failed_targets_str = failed_targets.map(target => `<@${target.id}>`).join(', ')
            return `Failed to send message to ${failed_targets.length}/${targets.length} members. I could not reach: ${failed_targets_str}.`
        } else {
            return `Message sent to ${targets.length} members.`
        }
    }

    // /enqueue [queue_name]
    async EnqueueUser(queue_name: string, member: GuildMember): Promise<void> {
        const queue = this.queues.find(queue => queue.name == queue_name)
        if (queue === undefined) {
            throw new UserError(`There is not a queue with the name ${queue_name}`)

        }
        if (!queue.is_open) {
            throw new UserError(`The queue "${queue_name}" is currently closed.`)
        }
        await queue.Enqueue(member)
    }

    // /queue add [queue_name]
    async CreateQueue(name: string): Promise<void> {
        if (name.toLowerCase() == 'admin' || name.toLowerCase() == 'staff') {
            throw new UserError(`Queues cannot be named "admin" or "staff"`)
        }

        if (this.queues.find(queue => queue.name == name) !== undefined) {
            throw new UserError(`A queue with the name ${name} already exists on this server.`)
        }

        await this.server.channels.create(name, { type: 'GUILD_CATEGORY' })
            .then(category => this.server.channels.create('queue', { type: 'GUILD_TEXT', parent: category }).then(queue_channel => {
                this.queues.push(new HelpQueue(name, new HelpQueueDisplayManager(this.client, queue_channel), this.member_states))
                return Promise.all([
                    queue_channel.permissionOverwrites.create(this.server.roles.everyone, { SEND_MESSAGES: false }),
                    queue_channel.permissionOverwrites.create(this.client.user as User, { SEND_MESSAGES: true })])
            }).then(() => this.server.channels.create('chat', { type: 'GUILD_TEXT', parent: category }))
            )

        await this.UpdateRoles()
    }

    // /queue remove [queue_name]
    async RemoveQueue(channel: GuildChannel): Promise<void> {
        const queue = this.queues.find(queue => queue.name == channel.name)
        if (channel.type !== 'GUILD_CATEGORY' || queue === undefined) {
            throw new UserError(`There is not a queue with the name ${channel.name}`)
        }

        this.queues = this.queues.filter(x => x != queue)
        await Promise.all((channel as CategoryChannel).children.map(child => child.delete()))
        await channel.delete()

        const role = this.server.roles.cache.find(role => role.name == channel.name)
        if (role !== undefined) {
            await role.delete()
        }
    }

    async DiscoverQueues(): Promise<void> {
        await this.server.channels.fetch()
            .then(channels => channels.filter(channel => channel.type == 'GUILD_CATEGORY'))
            .then(channels => channels.map(channel => channel as CategoryChannel))
            .then(categories => {
                categories.forEach(category => {
                    const queue_channel = category.children.find(child => child.name == 'queue')
                    if (queue_channel !== undefined && queue_channel.type == "GUILD_TEXT") {
                        if (this.queues.find(queue => queue.name == category.name) === undefined) {
                            this.queues.push(
                                new HelpQueue(category.name, new HelpQueueDisplayManager(this.client, queue_channel as TextChannel),
                                    this.member_states))
                        } else {
                            console.warn(`The server "${this.server.name}" contains multiple queues with the name "${category.name}"`)
                        }
                    }
                })
            })
    }

    //If roles don't exist already, create the roles
    private async EnsureRolesExist(roles: Collection<string, Role>) {
        let student_role = roles.find(role => role.name == "Student")
        if (student_role === undefined) {
            student_role = await this.server.roles.create({ name: 'Student', color: "GREEN" })
        }
        await student_role.setHoist(true)

        let staff_role = roles.find(role => role.name == "Staff")
        if (staff_role === undefined) {
            staff_role = await this.server.roles.create({ name: 'Staff', color: "RED" })
        }
        await staff_role.setHoist(true)

        let admin_role = roles.find(role => role.name == "Admin")
        if (admin_role === undefined) {
            admin_role = await this.server.roles.create({ name: 'Admin', color: "DARK_VIVID_PINK" })
        }
        await admin_role.setHoist(true)

        if (admin_role.comparePositionTo(staff_role) <= 0) {
            await staff_role.setPosition(admin_role.position - 1)
        }

        if (staff_role.comparePositionTo(student_role) <= 0) {
            await student_role.setPosition(staff_role.position - 1)
        }

        for (const queue of this.queues) {
            let queue_role = roles.find(role => role.name == queue.name)
            if (queue_role === undefined) {
                queue_role = await this.server.roles.create({ name: queue.name, color: "ORANGE" })
            }
            if (queue_role.comparePositionTo(staff_role) >= 0) {
                await queue_role.setPosition(staff_role.position - 1)
            }
        }

        return student_role
    }

    async EnsureHasRole(member: GuildMember): Promise<void> {
        if (member.roles.highest == this.server.roles.everyone) {
            const roles = await this.server.roles.fetch()
            const student_role = await this.EnsureRolesExist(roles)
            await member.roles.add(student_role)
        }
    }

    async UpdateRoles(): Promise<void | Role> {
        return this.server.roles.fetch()
            .then(roles => roles.sort((x, y) => x.createdTimestamp - y.createdTimestamp))
            .then(roles => this.EnsureRolesExist(roles))
            .catch(async (err) => {
                const owner = await this.server.fetchOwner();
                console.error(`Failed to update roles on "${this.server.name}". Error: ${err}`)
                await owner.send(`I can't update the roles on "${this.server.name}". You should check that my role is the highest on this server.`);
                return undefined;
            })
    }

    GetHelpingMemberStates(): Map<MemberState, string[]> {
        // Get a mapping between active helpers and the names of the queues
        // they are subscribed to
        const helping_members = new Map<MemberState, string[]>()
        this.member_states.forEach(state => {
            if (state.is_helping) {
                const queue_names = this.GetHelpableQueues(state.member)
                    .map(queue => queue.name)
                helping_members.set(state, queue_names)
            }
        })
        return helping_members
    }

    UpdateMemberJoinedVC(member: GuildMember): void {
        this.member_states.GetMemberState(member).OnJoin()
    }
    UpdateMemberLeftVC(member: GuildMember, dmMessage: string): void {
        //mayube here?
        this.member_states.GetMemberState(member).OnLeave(dmMessage)
    }
}