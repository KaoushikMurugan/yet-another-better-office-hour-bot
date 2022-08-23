/**************************************************************
 * This file implements the AttendingServer class
 * defines an instance of a server which the bot is connected to
 * implements various functions used by app.ts and 
 * command_handler.ts
 **************************************************************/

import { CategoryChannel, Client, Guild, GuildChannel, Role, TextChannel, User, Collection, GuildMember, Channel, Message } from "discord.js";
import { HelpQueue, HelpQueueDisplayManager } from "./queue";
import { MemberStateManager } from "./member_state_manager";
import { UserError } from "./user_action_error";
import { MemberState } from "./member_state_manager";
import { GoogleSpreadsheet, GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import * as gcs_creds from '../gcs_service_account_key.json';

import fetch from 'node-fetch';
import { EmbedColor, SimpleEmbed } from "./embed_helper";

import * as fs from 'fs';

export class AttendingServer {
    private queues: HelpQueue[] = []
    private member_states: MemberStateManager
    private client: Client
    private server: Guild
    private attendance_doc: GoogleSpreadsheet | null
    private attendance_sheet: GoogleSpreadsheetWorksheet | null = null
    private firebase_db: any

    private tutor_info_doc: GoogleSpreadsheet | null = null
    private tutor_info_sheet: GoogleSpreadsheetWorksheet | null = null
    private tutor_info_calendar: string | null = null

    private msgAfterLeaveVC: string | null = null
    private oldMsgALVC: string | null = null
    private msgEnable = false

    private updating_bot_command_channels = false

    private constructor(client: Client, server: Guild, firebase_db: any, attendance_doc: GoogleSpreadsheet | null) {
        this.client = client;
        this.server = server;
        this.member_states = new MemberStateManager();
        this.attendance_doc = attendance_doc;
        this.firebase_db = firebase_db;
    }

    /** 
     * Creates a new instance of a Attending Server 
     * @param client The discord client that is attached to the bot
     * @param server The discord server object that is to be connected to this class
     * @param firebase_db The Google Firebase database that stores server and user settings
     * @param attendance_doc The Google Spreadsheet that log tutor's hours
    */
    static async Create(client: Client, server: Guild, firebase_db: any, attendance_doc: GoogleSpreadsheet | null = null): Promise<AttendingServer> {
        if (server.me === null || !server.me.permissions.has("ADMINISTRATOR")) {
            await server.fetchOwner().then(owner =>
                owner.send(SimpleEmbed(`Sorry. I need full administrator permission to join and manage "${server.name}"`, EmbedColor.Error)));
            await server.leave();
            throw new UserError('Invalid permissions.');
        }

        const me = new AttendingServer(client, server, firebase_db, attendance_doc);

        //Collect server data from the database
        let doc = await firebase_db.collection('msgAfterLeaveVC').doc(server.id).get();
        if (doc.exists) {
            me.msgEnable = doc.data()["enable"];
            if (me.msgEnable === undefined) {
                me.msgEnable = true;
            }
            me.msgAfterLeaveVC = doc.data()["msgAfterLeaveVC"];
            if (me.msgAfterLeaveVC === undefined) {
                me.msgAfterLeaveVC = null;
            }
            me.oldMsgALVC = doc.data()["oldMsgALVC"];
            if (me.oldMsgALVC === undefined) {
                me.oldMsgALVC = null;
            }
        } else {
            me.msgAfterLeaveVC = null;
            me.msgEnable = true;
            me.oldMsgALVC = null;
        }

        let sheets_id: string | null = null;
        let doc_id: string | null = null;

        doc = await firebase_db.collection('tutor_info').doc(server.id).get();
        if (doc.exists) {
            doc_id = doc.data()["tutor_info_doc"];
            if (doc_id === undefined) {
                doc_id = null;
            }
            sheets_id = doc.data()["tutor_info_sheet"];
            if (sheets_id === undefined) {
                sheets_id = null;
            }
            me.tutor_info_calendar = doc.data()["tutor_info_calendar"];
            if (me.tutor_info_calendar === undefined) {
                me.tutor_info_calendar = null;
            }
        } else {
            me.tutor_info_doc = null;
            me.tutor_info_sheet = null;
            me.tutor_info_calendar = null;
        }

        if (doc_id !== null) {
            me.tutor_info_doc = new GoogleSpreadsheet(doc_id);
            await me.tutor_info_doc.useServiceAccountAuth(gcs_creds);
            await me.tutor_info_doc.loadInfo();
            if (sheets_id !== null) {
                me.tutor_info_sheet = me.tutor_info_doc.sheetsById[parseInt(sheets_id)];
            }
        }

        await me.DiscoverQueues();
        await me.UpdateRoles();
        await me.UpdateCommandHelpChannels();
        await Promise.all(me.queues.map(async queue => {
            await me.ForceQueueUpdate(queue.name);
        }));
        await server.members.fetch().then(members => members.map(member => me.EnsureHasRole(member)));
        return me;
    }

    /**
     * Clear all the queues in this server
     */
    async ClearAllQueues(): Promise<void> {
        await Promise.all(this.queues.map(queue => queue.Clear()));
    }

    /**
     * Clear a particular queue in this server
     * @param channel 
     */
    async ClearQueue(channel: CategoryChannel): Promise<void> {
        const queue = this.queues.find(queue => queue.name == channel.name);
        if (queue === undefined) {
            throw new UserError(`There is not a queue with the name ${channel.name}.`);
        }
        await queue.Clear();
    }

    /**
     * Returns a list of the queues a `member` can help in this server
     * @param member 
     * @returns An array of all the queues for which `member` helps for
     */
    private GetHelpableQueues(member: GuildMember) {
        return this.queues.filter(queue =>
            member.roles.cache.find(role => role.name == queue.name) !== undefined);
    }

    /**
     * Returns a list of users that help for the queue `queue_name`
     * @param queue_name 
     * @returns 
     */
    async GetHelpersForQueue(queue_name: string): Promise<Collection<string, GuildMember>> {
        return this.server.roles.fetch().then(roles => {
            const queue_role = roles.find(role => role.name == queue_name);
            if (queue_role === undefined) {
                throw new UserError(`There exists no queue with the name \`${queue_name}\``);
            }
            return queue_role.members;
        });
    }

    /**
     * Removes `member` from all queues on this server
     * @param member The member to be removed
     * @returns The new number of people in the queue
     */
    async RemoveMemberFromQueues(member: GuildMember): Promise<number> {
        let queue_count = 0;
        await Promise.all(this.queues.map(queue => {
            if (queue.Has(member)) {
                queue_count++;
                return queue.Remove(member);
            }
        }));
        return queue_count;
    }

    /** 
     * Removes `member` from `queue_name`
     * @param queue_name The queue from which `member` is removed
     * @param member The member that is to be removed
     */
    async RemoveMember(queue_name: string, member: GuildMember): Promise<void> {
        const queue = this.queues.find(queue => queue.name == queue_name);
        if (queue === undefined) {
            throw new UserError(`There is not a queue with the name ${queue_name}`);
        }
        await queue.Remove(member);
    }

    // consequence of /start, adds member (the caller of /start) to list of currently helping helpers for each queue
    /** 
     * Adds `member` to the list of avaiable helpers for each queue that they tutor for
     * @param member The member that has become available
     * @param mute_notif If set to false, then for each queue that becomes open after `member` becomes available, notify each member in the notif_queue that the queue has opened
     */
    async AddHelper(member: GuildMember, mute_notif: boolean): Promise<void> {
        const helpable_queues = this.GetHelpableQueues(member);
        if (helpable_queues.length == 0) {
            throw new UserError('You are a staff member but do not have any queue roles assigned. I don\'t know where you are allowed to help :(');
        }
        this.member_states.GetMemberState(member).StartHelping();
        await Promise.all(this.GetHelpableQueues(member).map(async queue => {
            queue.AddHelper(member, mute_notif);
            await queue.UpdateSchedule(await this.getUpcomingHoursTable(queue.name));
        }));
        // if the queue already has people, notify the the tutor that there is a queue that isn't empty
        this.GetHelpableQueues(member).forEach(queue => {
            if (queue.length > 0) {
                member.send(SimpleEmbed("There are some students in the queues already", EmbedColor.Warning));
                return;
            }
        });
    }

    /**
     * Logs `member`, `start_time` and current time into th attendance sheet
     * @param member The `member` for whom you want to update tutoring
     * @param start_time The time that `member` started tutoring
     */
    private async UpdateAttendanceLog(member: GuildMember, start_time: number): Promise<void> {
        if (this.attendance_doc === null) {
            return;
        }
        // Make sure there is an attendance sheet
        if (this.attendance_sheet === null) {
            await this.attendance_doc.loadInfo();
            //find the sheet whose name is the same as the server's name
            for (let i = 0; i < this.attendance_doc.sheetCount; i++) {
                const current_sheet = this.attendance_doc.sheetsByIndex[i];
                if (current_sheet.title == this.server.name) {
                    this.attendance_sheet = current_sheet;
                }
            }
            // if sheet doesn't exist for the discord server already, make a new one
            // name of the sheet should be the same as the name of the discord server
            // table headers are "username | time in | time out | helped students"
            if (this.attendance_sheet === null) {
                this.attendance_sheet = await this.attendance_doc.addSheet({ 'title': this.server.name, 'headerValues': ['username', 'time in', 'time out', 'helped students'] });
            }
        }
        // Update with this info
        // set the starting time
        const start = new Date(start_time);
        const start_time_str = `${start.toLocaleDateString()} ${start.toLocaleTimeString()}`;
        // get the ending time
        const end = new Date(Date.now());
        const end_time_str = `${end.toLocaleDateString()} ${end.toLocaleTimeString()}`;
        // get the list of helped students
        const helped_students = JSON.stringify(this.member_states.GetMemberState(member).members_helped.map(member => new Object({ nick: member.nickname, username: member.user.username })));
        // add new row to the sheet
        await this.attendance_sheet.addRow({ 'username': member.user.username, 'time in': start_time_str, 'time out': end_time_str, 'helped students': helped_students });
    }

    // consequence of /stop, removes "member" from the list of avaiable helpers
    /**
     * Removes `member` from the list of available helpers
     * @param member 
     * @returns The duration that `member` has helped for in the current session
     */
    async RemoveHelper(member: GuildMember): Promise<number> {
        // Remove a helper and return the time they spent helping in ms
        await Promise.all(this.GetHelpableQueues(member).map(async queue => {
            queue.RemoveHelper(member);
            await queue.UpdateSchedule(await this.getUpcomingHoursTable(queue.name));
        }));
        const start_time = this.member_states.GetMemberState(member).StopHelping();
        // Update the attendance log in the background
        void this.UpdateAttendanceLog(member, start_time).catch(err => {
            console.error(`Failed to update the attendance log for ${member.user.username} who helped for ${Math.round((Date.now() - start_time) / 60000)} mins`);
            console.error(`Error: ${err}`);
        });
        return Date.now() - start_time;
    }

    /**
     * Removes a person (if there is one) from a queue that the `helper` helps for.
     * If `queue_option` and `user_option` are not set or are null, then this function dequeues the person who has been waiting the longest, of the queues that the helper helps for
     * @param helper The member that is a helper who wants to call in the next person to their office
     * @param queue_option ***Optional*** The queue from which a member has to be dequeued from. Default: null
     * @param user_option  ***Optional*** The member that has to be dequeued. Default: null
     * @returns `MemberState` of the memeber that got dequeued
     */
    async Dequeue(helper: GuildMember, queue_option: CategoryChannel | null = null, user_option: User | GuildMember | null = null): Promise<MemberState> {
        // Get the next member for a helper to assist
        if (!this.member_states.GetMemberState(helper).is_helping) {
            throw new UserError('You haven\'t started helping yet. Try sending "/start" first.');
        }

        const helpable_queues = this.GetHelpableQueues(helper);
        if (helpable_queues.length == 0) {
            throw new UserError('You are not registered as a helper for any queues.');
        }

        // if user entered a particular user to dequeue
        if (user_option !== null) {
            const member = user_option instanceof User ? await this.server.members.fetch(user_option) : user_option;
            const member_state = this.member_states.GetMemberState(member);
            const member_queue = member_state.queue;
            if (member_queue === null) {
                throw new UserError(`<@${member.id}> is not in a queue.`);
            } else if (!helpable_queues.includes(member_queue)) {
                throw new UserError(`You are not registered as a helper for "${member_queue.name}" which <@${member.id}> is in.`);
            }
            await this.RemoveMemberFromQueues(member);
            this.member_states.GetMemberState(helper).OnDequeue(member);
            member_state.SetUpNext(true);
            return member_state;
        }

        // if user entered a particular queue to remove from
        let target_queue: HelpQueue;
        if (queue_option !== null) {
            const queue = this.queues.find(queue => queue.name == queue_option.name);
            if (queue === undefined) {
                throw new UserError(`There is not a queue with the name ${queue_option.name}`);
            }
            if (!helpable_queues.includes(queue)) {
                throw new UserError(`You are not registered as a helper for ${queue.name}`);
            }
            target_queue = queue;
        } else { // if no options were added, dequeue the person who has been waiting the longest
            const wait_times = helpable_queues.map(queue => queue.Peek()).map(state => state === undefined ? -Infinity : state.GetWaitTime());
            const index_of_max = wait_times.indexOf(Math.max(...wait_times));
            target_queue = helpable_queues[index_of_max];
        }
        // if there's no-one to dequeue
        if (target_queue.length == 0) {
            throw new UserError('There is no one left to help. Now might be a good time for a coffee.');
        }
        const target_member_state = await target_queue.Dequeue();
        this.member_states.GetMemberState(helper).OnDequeue(target_member_state.member);
        target_member_state.SetUpNext(true);
        return target_member_state;
    }

    /**
     * Send a `message` to each person waiting in `author`'s queue(s)
     * @param queue_option ***Optional*** The queue who's members the announcement has to be sent to. Default: null
     * @param message The message that is to be sent
     * @param author The helper for whose queues the message is to be sent to
     * @returns `string`: A message that is to be sent to the user, and a `boolean`: true if the command succeeds
     */
    async Announce(queue_option: GuildChannel | null, message: string, author: GuildMember): Promise<[string, boolean]> {
        const queue_name = queue_option !== null ? queue_option.name : null;

        // If a queue name is specified, check that a queue with that name exists
        if (queue_name !== null) {
            const queue = this.queues.find(queue => queue.name == queue_name);
            if (queue === undefined) {
                throw new UserError(`There is not a queue with the name ${queue_name}`);
            }
        }

        // Find the members to announce to
        const targets: GuildMember[] = [];
        this.member_states.forEach(member_state => {
            // If the user is not in a queue, don't announce to them
            if (member_state.queue === null)
                return;

            if (queue_name !== null) {
                if (member_state.queue.name == queue_name) {
                    targets.push(member_state.member);
                }
            } else {
                targets.push(member_state.member);
            }
        });

        // Send the message in dm of each person in the queue 
        const message_string = `<@${author.id}> says: ${message}`;
        const failed_targets: GuildMember[] = [];
        await Promise.all(
            targets.map(target => target.send(SimpleEmbed(message_string, EmbedColor.Warning)).catch(() => {
                failed_targets.push(target);
            }
            )));

        // Report any failures to the message author
        if (failed_targets.length > 0) {
            const failed_targets_str = failed_targets.map(target => `<@${target.id}>`).join(', ');
            return [`Failed to send message to ${failed_targets.length}/${targets.length} members. I could not reach: ${failed_targets_str}.`, false];
        } else {
            return [`Message sent to ${targets.length} members.`, true];
        }
    }

    /**
     * Adds `member` to the queue `queue_name`
     * @param queue_name 
     * @param member 
     */
    async EnqueueUser(queue_name: string, member: GuildMember): Promise<void> {
        const queue = this.queues.find(queue => queue.name == queue_name);
        if (queue === undefined) {
            throw new UserError(`There is not a queue with the name ${queue_name}`);

        }
        if (!queue.is_open) {
            throw new UserError(`The queue "${queue_name}" is currently closed.`);
        }
        await queue.Enqueue(member);
    }

    /**
     * Creates a new queue category with two text channels within it: `#queue` and `#chat`
     * @param name The name of the category
     */
    async CreateQueue(name: string): Promise<void> {
        if (name.toLowerCase() == 'admin' || name.toLowerCase() == 'staff') {
            throw new UserError(`Queues cannot be named "admin" or "staff"`);
        }

        if (this.queues.find(queue => queue.name == name) !== undefined) {
            throw new UserError(`A queue with the name ${name} already exists on this server.`);
        }

        await this.server.channels.create(name, { type: 'GUILD_CATEGORY' })
            .then(category => this.server.channels.create('queue', { type: 'GUILD_TEXT', parent: category }).then(queue_channel => {
                this.queues.push(new HelpQueue(name, new HelpQueueDisplayManager(this.client, queue_channel, null, null), this.member_states));
                return Promise.all([
                    queue_channel.permissionOverwrites.create(this.server.roles.everyone, { SEND_MESSAGES: false }),
                    queue_channel.permissionOverwrites.create(this.client.user as User, { SEND_MESSAGES: true })]);
            }).then(() => this.server.channels.create('chat', { type: 'GUILD_TEXT', parent: category }))
            );

        await this.UpdateRoles();
        await this.ForceQueueUpdate(name);
    }

    /**
     * Removes the category `channel` and the channels within it
     * @param channel The name of the category to be removed
     */
    async RemoveQueue(channel: GuildChannel): Promise<void> {
        const queue = this.queues.find(queue => queue.name == channel.name);
        if (channel.type !== 'GUILD_CATEGORY' || queue === undefined) {
            throw new UserError(`There is not a queue with the name ${channel.name}`);
        }

        this.queues = this.queues.filter(x => x != queue);
        const x = await Promise.all<Channel | void>((channel as CategoryChannel).children.map(child => {
            return child.delete();
        }));
        await channel.delete();

        const role = this.server.roles.cache.find(role => role.name == channel.name);
        if (role !== undefined) {
            await role.delete();
        }
    }

    /**
     * Adds `member` to the notification queue of `queue_name`
     * @param member 
     * @param queue_name 
     */
    async JoinNotifications(queue_name: string, member: GuildMember): Promise<void> {
        const queue = this.queues.find(queue => queue.name == queue_name);
        if (queue === undefined) {
            throw new UserError(`There is not a queue with the name ${queue_name}`);
        }
        await queue.AddToNotifQueue(member);
        member.send(SimpleEmbed("You will be notified when the queue becomes open.", EmbedColor.Success));
    }

    /**
     * Removes `member` from the notification queue of `queue_name`
     * @param member 
     * @param queue_name 
     */
    async RemoveNotifications(queue_name: string, member: GuildMember): Promise<void> {
        const queue = this.queues.find(queue => queue.name == queue_name);
        if (queue === undefined) {
            throw new UserError(`There is not a queue with the name ${queue_name}`);
        }
        await queue.RemoveFromNotifQueue(member);
        member.send(SimpleEmbed("You will no longer be notified when the queue becomes open.", EmbedColor.Success));
    }

    /**
     * Goes through all the channls in the server, finds all the queue categories and adds them to the list of queues 
     * associated with this server. Also stores the messages (ids) of the queue and schedule messages for each queue object.
     */
    async DiscoverQueues(): Promise<void> {
        await this.server.channels.fetch()
            .then(channels => channels.filter(channel => channel.type == 'GUILD_CATEGORY'))
            .then(channels => channels.map(channel => channel as CategoryChannel))
            .then(categories =>
                Promise.all(categories.map(category => {
                    const queue_channel = category.children.find(child => child.name == 'queue') as TextChannel;
                    if (queue_channel !== undefined && queue_channel.type == "GUILD_TEXT") {
                        if (this.queues.find(queue => queue.name == category.name) === undefined) {
                            // get the queue message and schedule message if they already exists
                            return queue_channel.messages.fetchPinned()
                                .then(messages => messages.filter(msg => msg.author == this.client.user))
                                .then(messages => {
                                    if (messages.size === 2) {
                                        const first_message = messages.first();
                                        const second_message = messages.last();
                                        if (first_message === undefined || second_message === undefined)
                                            return [null, null];
                                        return [first_message, second_message];
                                    } else {
                                        messages.forEach(message => message.delete());
                                        messages.clear();
                                        return [null, null];
                                    }
                                }).then(async messages => {
                                    this.queues.push(
                                        new HelpQueue(category.name, new HelpQueueDisplayManager(this.client, queue_channel, messages[0], messages[1]),
                                            this.member_states));
                                    await (await queue_channel.messages.fetch()).forEach(message => {
                                        if(message.pinned === false)
                                            message.delete();
                                    });
                                });
                        } else {
                            console.warn(`The server "${this.server.name}" contains multiple queues with the name "${category.name}"`);
                        }
                    }
                }))
            );
    }

    //If roles don't exist already, create the roles
    /**
     * Searches through a role list for roles named "Student", "Staff", "Admin" and the helper role for each queue. If any one of 
     * them doesn't exist,then create those roles. Also ensures that the "Admin" role is above the "Staff" which is above the 
     * "Student" role. The helper roles are ensured to be below the staff role but above the student roles
     * @param roles Collection of <string: name of role, Role: role object>
     * @returns `Role`: the student role
     */
    private async EnsureRolesExist(roles: Collection<string, Role>) {
        let student_role = roles.find(role => role.name == "Student");
        if (student_role === undefined) {
            student_role = await this.server.roles.create({ name: 'Student', color: "GREEN" });
        }
        await student_role.setHoist(true);

        let staff_role = roles.find(role => role.name == "Staff");
        if (staff_role === undefined) {
            staff_role = await this.server.roles.create({ name: 'Staff', color: "RED" });
        }
        await staff_role.setHoist(true);

        let admin_role = roles.find(role => role.name == "Admin");
        if (admin_role === undefined) {
            admin_role = await this.server.roles.create({ name: 'Admin', color: "DARK_VIVID_PINK" });
        }
        await admin_role.setHoist(true);

        if (admin_role.comparePositionTo(staff_role) <= 0) {
            await staff_role.setPosition(admin_role.position - 1);
        }

        if (staff_role.comparePositionTo(student_role) <= 0) {
            await student_role.setPosition(staff_role.position - 1);
        }

        for (const queue of this.queues) {
            let queue_role = roles.find(role => role.name == queue.name);
            if (queue_role === undefined) {
                queue_role = await this.server.roles.create({ name: queue.name, color: "ORANGE" });
            }
            if (queue_role.comparePositionTo(staff_role) >= 0) {
                await queue_role.setPosition(staff_role.position - 1);
            }
        }

        return student_role;
    }

    /**
     * Ensures that `member` has the student role
     * @param member 
     */
    async EnsureHasRole(member: GuildMember): Promise<void> {
        if (member.roles.highest == this.server.roles.everyone) {
            const roles = await this.server.roles.fetch();
            const student_role = await this.EnsureRolesExist(roles);
            await member.roles.add(student_role);
        }
    }

    /**
     * Update the roles list on the server with respect to the queues in the server
     * @returns TODO: returns something, however it is never used
     */
    async UpdateRoles(): Promise<void | Role> {
        return this.server.roles.fetch()
            .then(roles => roles.sort((x, y) => x.createdTimestamp - y.createdTimestamp))
            .then(roles => this.EnsureRolesExist(roles))
            .catch(async (err) => {
                const owner = await this.server.fetchOwner();
                console.error(`Failed to update roles on "${this.server.name}". Error: ${err}`);
                await owner.send(SimpleEmbed(`I can't update the roles on "${this.server.name}". You should check that my role is the highest on this server.`, EmbedColor.Error));
                return undefined;
            });
    }

    /**
     * Ensures that the queue in the category `queue_name` has a valid message that can show the queue in text form
     * @param queue_name The name of the category
     */
    async EnsureQueueSafe(queue_name: string): Promise<void> {
        const queue = this.queues.find(queue => queue.name == queue_name);
        if (queue === undefined) {
            return;
        }
        await queue.EnsureQueueSafe();
    }

    /**
     * Forces the queue in the category `queue_name` to be updated, causing it to post a new queue message or edit an existing one
     * @param queue_name The queue that needs to be updated
     */
    async ForceQueueUpdate(queue_name: string): Promise<void> {
        const queue = this.queues.find(queue => queue.name == queue_name);
        if (queue === undefined) {
            return;
        }
        const queue_message = await queue.UpdateDisplay();
        const schedule_message = await queue.UpdateSchedule(await this.getUpcomingHoursTable(queue_name));
        if (queue_message !== null && queue_message !== undefined) { // if not void, new messages was created
            if (schedule_message === null || schedule_message === undefined) {
                console.log("queue_message for " + queue_name + " was not void, but it's schedule message was void");
                return;
            } else {
                // Discord orders pin list by newest first
                await schedule_message.pin();
                await queue_message.pin()
                ;(await queue_message.channel.messages.fetch()).forEach(message => {
                    if(message.pinned !== true)
                        message.delete();
                });
            }
        }
    }

    async ForceUpdateAllQueues(): Promise<void> {
        if (this.queues.length > 0) {
            Promise.all(this.queues.map(queue => {
                this.ForceQueueUpdate(queue.name);
            }));
        } else {
            throw new UserError("There are no queues to update");
        }
    }

    /**
     * Edit the message that is sent to a member after they finish a session with a helper. Updates the database with the new message
     * @param message The new message that is to be sent to users
     * @param enable Whether or not to send the message
     * @returns `string`: A message that is to be sent to the user
     */
    async EditDmMessage(message: string | null, enable: boolean): Promise<string> {
        // update local instance of message
        this.oldMsgALVC = this.msgAfterLeaveVC;
        this.msgEnable = enable;
        this.msgAfterLeaveVC = message;

        // update database with new value, only if it's new
        if (this.oldMsgALVC !== message) {
            const data = {
                msgAfterLeaveVC: message,
                oldMsgALVC: this.oldMsgALVC,
                enable: enable
            };
            await this.firebase_db.collection('msgAfterLeaveVC').doc(this.server.id).set(data);
        }
        let response: string;
        if (enable === true && this.msgAfterLeaveVC !== null) {
            response = "BOB will now send the following message to students once they finish recieving tutoring: \n\n" + this.msgAfterLeaveVC;
        } else if (enable === true && this.msgAfterLeaveVC === null) {
            response = "BOB has enabled the sending a message after a session feature, but there is no message saved for this server";
        } else {
            response = "BOB will no longer send a messages to tutees after the finish recieving tutoring. \
If you wish to enable this feature later, just set the enable option to true.";
        }
        return response;
    }

    /**
     * Swaps the message that woud be sent to members after they finish a session with a helper, with the previous version.
     * @returns `string`: A message that is to be sent to the user
     */
    async RevertDmMessage(): Promise<string> {
        const temp = this.oldMsgALVC;
        this.oldMsgALVC = this.msgAfterLeaveVC;
        this.msgAfterLeaveVC = temp;

        // update database with new value, only if it's new
        if (this.oldMsgALVC !== this.msgAfterLeaveVC) {
            const data = {
                msgAfterLeaveVC: this.msgAfterLeaveVC,
                oldMsgALVC: this.oldMsgALVC,
                enable: this.msgEnable
            };
            await this.firebase_db.collection('msgAfterLeaveVC').doc(this.server.id).set(data);
        }

        let response: string;
        if (this.msgEnable === true && this.msgAfterLeaveVC !== null) {
            response = "BOB will now send the following message to students once they finish receiving tutoring: \n\n" + this.msgAfterLeaveVC;
        } else if (this.msgEnable === true && this.msgAfterLeaveVC === null) {
            response = "BOB has enabled the sending a message after a session feature, but there is no message saved for this server";
        } else if (this.msgAfterLeaveVC !== null) {
            response = "The message has been reverted to: \n\n" + this.msgAfterLeaveVC + "\n\n but the dm feature is currently\
disabled. To enable it, do `/post_session_msg enable: true`";
        } else {
            response = "The message has been reverted to `null` and the dm feature is currently disabled";
        }
        return response;
    }

    /**
     * @returns a Collection of Calendar names to discord user ids
     */
    private async getQueueHelpersFirstNames(): Promise<Collection<string, string> | null> {
        const HelperNames = new Collection<string, string>([]);

        if (this.tutor_info_doc === null || this.tutor_info_sheet === null) {
            return null;
        }

        let IDColNum = -1;
        let NameColNum = -1;

        let rows: GoogleSpreadsheetRow[];
        rows = await this.tutor_info_sheet.getRows();
        NameColNum = this.tutor_info_sheet.headerValues.indexOf("Calendar Name");
        IDColNum = this.tutor_info_sheet.headerValues.indexOf("Discord ID");
        await rows.forEach(row => {
            HelperNames.set(row._rawData[NameColNum], row._rawData[IDColNum]);
        });

        return HelperNames;
    }

    /**
     * Sets the calendar that contains the schedule of the helpers
     * @param calendar_id 
     * @returns `string`: A message that is to be sent to the user, and a `boolean`: true if the command succeeds
     */
    async setTutorCalendar(calendar_id: string): Promise<[string, boolean]> {
        let calendarName: string | null = null;

        //attempt a connection to the calendar. If successful, send the name of the calendar back as confirmation

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/' + calendar_id + '/events?key=' + process.env.BOB_GOOGLE_CALENDAR_API_KEY);
        const data = await response.json();

        if (data !== null) {
            calendarName = data.summary;
        } else {
            calendarName = null;
        }

        if (calendarName === undefined) {
            return ["Something went wrong. Please try again", false];
        } else if (calendarName === null) {
            return ["Calendar link was invalid, or wasn't able to connect to calendar", false];
        } else {
            //update the database (if new value)
            if (this.tutor_info_calendar !== calendar_id) {
                const tutorData = {
                    tutor_info_calendar: calendar_id,
                    tutor_info_doc: this.tutor_info_doc?.spreadsheetId,
                    tutor_info_sheet: this.tutor_info_sheet?.sheetId
                };
                await this.firebase_db.collection('tutor_info').doc(this.server.id).set(tutorData);
            }

            this.tutor_info_calendar = calendar_id;

            return ["Connected to the Google calendar: " + calendarName, true];
        }
    }

    /**
     * Sets the sheets that contains the list of names and their discord IDs
     * @param doc_id 
     * @param sheets_id 
     * @returns `string`: A message that is to be sent to the user, and a `boolean`: true if the command succeeds
     */
    async setTutorSheets(doc_id: string, sheets_id: string): Promise<[string, boolean]> {

        let tutor_doc: GoogleSpreadsheet | null = null;
        let tutor_sheet: GoogleSpreadsheetWorksheet | null = null;

        tutor_doc = new GoogleSpreadsheet(doc_id);
        await tutor_doc.useServiceAccountAuth(gcs_creds);
        await tutor_doc.loadInfo();

        tutor_sheet = tutor_doc.sheetsById[parseInt(sheets_id)];

        if (tutor_doc === undefined || tutor_sheet === undefined) {
            return ["Something went wrong. Please try again", false];
        } else if (tutor_doc === null || tutor_sheet === null) {
            return ["Sheets link was invalid, or wasn't able to connect to sheets", false];
        } else {
            //update the database (if new value)
            if (this.tutor_info_doc !== tutor_doc || this.tutor_info_sheet !== tutor_sheet) {
                const tutorData = {
                    tutor_info_calendar: this.tutor_info_calendar,
                    tutor_info_doc: doc_id,
                    tutor_info_sheet: sheets_id
                };
                await this.firebase_db.collection('tutor_info').doc(this.server.id).set(tutorData);
            }

            this.tutor_info_doc = tutor_doc;
            this.tutor_info_sheet = tutor_sheet;

            return ["Connected to the Google Sheet document: " + tutor_doc.title + " -> " + tutor_sheet.title, true];
        }
    }

    /**
     * Returns a table that lists the start and end times of upcoming events for this queue
     * @param queue_name 
     * @returns `string`: A message that is to be sent to the user, and a `Date`: the next update time for the queue
     */
    async getUpcomingHoursTable(queue_name: string): Promise<[string, Date]> {
        if (this.tutor_info_calendar === null || this.tutor_info_doc === null || this.tutor_info_sheet === null) {
            return ["The necessary resources for this command to work have not been set up. Please contact an admin to set it up", new Date(0)];
        }

        const queue = this.queues.find(queue => queue.name == queue_name);
        if (queue === undefined) {
            return ["Invalid queue channel", new Date(0)];
        }

        const helpersMap = await this.GetHelpersForQueue(queue_name);

        // Get all the corresponding first names via the google sheets doc

        const helpersNameMap = await this.getQueueHelpersFirstNames();

        const minDate = new Date();
        const maxDate = new Date();
        maxDate.setDate(minDate.getDate() + 7);

        // Fetch the events in the calendar that end after the current time upto a week and sort by start time

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/' + this.tutor_info_calendar +
            '/events?orderBy=startTime&singleEvents=true&timeMax=' + maxDate.toISOString()
            + '&timeMin=' + minDate.toISOString()
            + '&key=' + process.env.BOB_GOOGLE_CALENDAR_API_KEY);

        const data = await response.json();

        let numItems = 0;
        const maxItems = 5;

        let table = new String;

        const update_time = new Date(0);

        await data.items.forEach((event: { summary: string; start: { dateTime: string; }; end: { dateTime: string; }; }) => {
            let pos = event.summary.indexOf(" - ");
            if ( pos === -1 ) {
                pos = event.summary.length;
            }
            const helperName = event.summary.substring(0, pos);
            const eventTitle = event.summary.substring(pos + 3);
            const discordID = helpersNameMap?.get(helperName);
            if (discordID !== undefined && discordID !== null) {

                const helper = helpersMap.get(discordID);

                //use https://hammertime.cyou/en-GB for reference on how to display dynamic time on discord

                if (helper !== undefined && discordID !== null && numItems < maxItems) {
                    const userPing = '<@' + helper.id + '> | ' + eventTitle;

                    const startTime = new Date(Date.parse(event.start.dateTime));
                    let startTimeEpoch = startTime.getTime().toString();
                    startTimeEpoch = startTimeEpoch.substring(0, startTimeEpoch.length - 3);
                    //Discord dynamic time doesn't use milliseconds, so need to trim off the last 3 digits of the epoch time

                    const startTimeString = '<t:' + startTimeEpoch + ':f>';
                    const relativeStartTime = '<t:' + startTimeEpoch + ':R>';

                    const endTime = new Date(Date.parse(event.end.dateTime));
                    //if it's the first event, set schedule update time to end of this event
                    if (update_time.getTime() === 0) {
                        update_time.setTime(endTime.getTime());
                    }

                    let endTimeEpoch = endTime.getTime().toString();
                    endTimeEpoch = endTimeEpoch.substring(0, endTimeEpoch.length - 3);

                    const endTimeString = '<t:' + endTimeEpoch + ':f>';
                    const relativeEndTime = '<t:' + endTimeEpoch + ':R>';

                    table = table + userPing + "\nStarts at " + startTimeString + " which is " + relativeStartTime
                        + " | Ends at: " + endTimeString + " which is " + relativeEndTime + "\n";

                    numItems++;
                }
            }
        });
        let current_helpers = new String();
        if (queue.helpers_set.size > 0) {
            current_helpers = "Currently available: ";
            queue.helpers_set.forEach(helper => {
                current_helpers += "<@" + helper.id + ">, ";
            });
            current_helpers = current_helpers.slice(0, -2);
        } else {
            current_helpers = "No-one is currently helping for **" + queue_name + "**";
        }
        const moreInfo = "You can view the full calendar here: " + "https://calendar.google.com/calendar/embed?src=" + this.tutor_info_calendar;
        if (numItems === 0) {
            table = 'There are no scheduled hours for this queue in next 7 days.';
            update_time.setDate(new Date().getDate() + 3);
        }
        return [current_helpers + "\n\n" + table + '\n' + moreInfo, update_time];
    }

    /**
     * @returns a mapping between active helpers and the names of the queues they help for
     */
    GetHelpingMemberStates(): Map<MemberState, string[]> {
        const helping_members = new Map<MemberState, string[]>();
        this.member_states.forEach(state => {
            if (state.is_helping) {
                const queue_names = this.GetHelpableQueues(state.member)
                    .map(queue => queue.name);
                helping_members.set(state, queue_names);
            }
        });
        return helping_members;
    }

    /**
     * Updates the GuildMember object `member` to say that the object associated with it has joined a voice channel.
     * @param member 
     */
    UpdateMemberJoinedVC(member: GuildMember): void {
        this.member_states.GetMemberState(member).OnJoinVC();
    }

    /**
     * Updates the GuildMember object `member` to say that the object associated with it has left a voice channel.
     * Sends a server-unique message to `member` if there is a valid message associated with this server and if the 
     * feature has been enabled
     * @param member The member which has just left a session with a tutor
     */
    UpdateMemberLeftVC(member: GuildMember): void {
        if (this.msgAfterLeaveVC === null || this.msgEnable === false) {
            this.member_states.GetMemberState(member).OnLeaveVC(null);
            return;
        }
        else {
            this.member_states.GetMemberState(member).OnLeaveVC(this.msgAfterLeaveVC);
        }
    }

    /**
     * Returns the message that is sent to members after they leave a session with a helper
     * @returns msgAfterLeaveVC
     */
    getMsgAfterLeaveVC(): string | null {
        return this.msgAfterLeaveVC;
    }

    async AutoScheduleUpdates(server: AttendingServer): Promise<void[]> {
        // Thanks to @tomli380576 for providing most of the code and logic for this
        return this.queues.map(queue => {
            let timerID = setTimeout(async function tick() {
                await queue.UpdateSchedule(await server.getUpcomingHoursTable(queue.name));
                const newTimeDelta = Math.abs(queue.update_time.getTime() - (new Date()).getTime());
                // immediately schedule a new async call
                timerID = setTimeout(tick, newTimeDelta);
            }, 0);
        });
    }

    async UpdateCommandHelpChannels(channel_name: string | null = null): Promise<void> {
        if (this.updating_bot_command_channels === true) {
            // * console.log("canceled")
            return;
        }
        
        if (channel_name !== null) {
            if (channel_name !== 'admin-commands' && channel_name !== 'helper-commands' && channel_name !== 'student-commands') {
                return;
            }
        }

        this.updating_bot_command_channels = true;

        await this.server.channels.fetch()
            .then(channels => channels.filter(channel => channel.type == 'GUILD_CATEGORY'))
            .then(channels => {
                return channels.find(channel => channel.name == 'Bot Commands Help') as CategoryChannel;
            })
            .then(async category => {
                if (category === null || category === undefined) {
                    category = await this.server.channels.create("Bot Commands Help", { type: "GUILD_CATEGORY" });
                    
                    const admin_command_channel = await category.createChannel('admin-commands');
                    admin_command_channel.permissionOverwrites.create(this.server.roles.everyone, { SEND_MESSAGES: false });
                    admin_command_channel.permissionOverwrites.create(this.client.user as User, { SEND_MESSAGES: true });
                    //admin_command_channel.permissionOverwrites.create(this.server.roles.everyone, { VIEW_CHANNEL: false })
                    // TODO following function doesn't regocnize 'Admin' as a role, even though it accepts string as a parameter
                    //admin_command_channel.permissionOverwrites.create('Admin', { VIEW_CHANNEL: true })
                    
                    const helper_command_channel = await category.createChannel('helper-commands');
                    helper_command_channel.permissionOverwrites.create(this.server.roles.everyone, { SEND_MESSAGES: false });
                    helper_command_channel.permissionOverwrites.create(this.client.user as User, { SEND_MESSAGES: true });
                    //helper_command_channel.permissionOverwrites.create(this.server.roles.everyone, { VIEW_CHANNEL: false })
                    // TODO following function doesn't regocnize 'Staff' as a role, even though it accepts string as a parameter
                    //helper_command_channel.permissionOverwrites.create('Staff', { VIEW_CHANNEL: true })
                    
                    const student_command_channel = await category.createChannel('student-commands');
                    student_command_channel.permissionOverwrites.create(this.server.roles.everyone, { SEND_MESSAGES: false });
                    student_command_channel.permissionOverwrites.create(this.client.user as User, { SEND_MESSAGES: true });
                    
                    this.updating_bot_command_channels = false;

                    return category;
                } else {
                    return category;
                }
            })
            .then(category => {
                this.newfunction(category, channel_name);
            });

        this.updating_bot_command_channels = false;
    }

    async newfunction(category: CategoryChannel, channel_name: string | null) {
        //ADMIN
        let admin_commands_channel = category.children.find(channel => channel.name == 'admin-commands') as TextChannel;
        if (admin_commands_channel === null || admin_commands_channel === undefined) {
            category.createChannel('admin-commands').then(channel => {
                admin_commands_channel = channel;
            });
        }
        if(admin_commands_channel.name === channel_name || channel_name === null) {
            admin_commands_channel.messages.fetch().then(messages => {
                if (messages.size > 0) {
                    messages.forEach(message => message.delete());
                }
            });
            admin_commands_channel.send({ embeds: SimpleEmbed(fs.readFileSync(__dirname + '/../../help-channel-messages/admin-commands.txt', { "encoding": 'utf8' })).embeds });
        }

        //HELPER
        let helper_commands_channel = category.children.find(channel => channel.name == 'helper-commands') as TextChannel;
        if (helper_commands_channel === null || helper_commands_channel === undefined) {
            category.createChannel('helper-commands').then(channel => {
                helper_commands_channel = channel;
            });
        }
        if(helper_commands_channel.name === channel_name || channel_name === null) {
            helper_commands_channel.messages.fetch().then(messages => {
                if (messages.size > 0) {
                    messages.forEach(message => message.delete());
                }
            });
            helper_commands_channel.send({ embeds: SimpleEmbed(fs.readFileSync(__dirname + '/../../help-channel-messages/helper-commands.txt', { "encoding": 'utf8' })).embeds });
        }

        //STUDENT
        let student_commands_channel = category.children.find(channel => channel.name == 'student-commands') as TextChannel;
        if (student_commands_channel === null || student_commands_channel === undefined) {
            category.createChannel('student-commands').then(channel => {
                student_commands_channel = channel;
            });
        }
        if(student_commands_channel.name === channel_name || channel_name === null) {
            student_commands_channel.messages.fetch().then(messages => {
                if (messages.size > 0) {
                    messages.forEach(message => message.delete());
                }
            });
            student_commands_channel.send({ embeds: SimpleEmbed(fs.readFileSync(__dirname + '/../../help-channel-messages/student-commands.txt', { "encoding": 'utf8' })).embeds });
        }
    }
}
