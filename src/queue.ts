/**********************************************************************************
 * This file defines the HelpQueueDisplayManager and the Help Queue class
 * HelpQueueDisplayManager manages the message that's in the #queue channels
 * HelpQueue impliments a queue for each channel and also various functions for it
 * .setRequired defines where the argument is required or ont
 **********************************************************************************/

import {
    Client,
    GuildMember,
    Message,
    MessageActionRow,
    MessageButton,
    TextChannel,
    MessageEmbed,
} from "discord.js";
import { MemberState, MemberStateManager } from "./member_state_manager";
import { UserError } from "./user_action_error";
import AsciiTable from "ascii-table";
import "./embed_helper";

export class HelpQueueDisplayManager {
    private client: Client;
    private display_channel: TextChannel;
    private queue_message: Message | null;
    private schedule_message: Message | null;
    private schedule_update_time: Date;

    constructor(
        client: Client,
        display_channel: TextChannel,
        queue_message: Message | null,
        schedule_message: Message | null
    ) {
        this.client = client;
        this.display_channel = display_channel;
        this.queue_message = queue_message;
        this.schedule_message = schedule_message;
        this.schedule_update_time = new Date();
    }

    get update_time(): Date {
        return this.schedule_update_time;
    }

    public async setScheduleUpdateTime(time: Date): Promise<void> {
        if (time.getTime() >= new Date().getTime()) {
            this.schedule_update_time.setTime(time.getTime());
        } else {
            this.schedule_update_time.setDate(new Date().getDate() + 1);
        }
    }

    /**
     *
     * @param queue
     * @param queue_members
     * @returns a table of the list of people in queue in text form that can be used in a message
     */
    private GetQueueText(
        queue: HelpQueue,
        queue_members: MemberState[]
    ): string[] {
        const quant_prase =
            queue.length === 1 ? "is 1 person" : `are ${queue.length} people`;
        const status_line = `The queue is **${
            queue.is_open ? "OPEN" : "CLOSED"
        }**. There ${quant_prase} in the queue.\n`;
        if (queue.length > 0) {
            const table = new AsciiTable();
            table.setHeading("Position", "Username");
            queue_members.forEach((state, idx) =>
                table.addRow(idx + 1, state.member.user.username)
            );
            return [status_line, "```\n" + table.toString() + "\n```"];
        }
        return [status_line];
    }

    /**
     * Checks the channel if the bot has sent exactly two messages, which should be the queue_message and the schedule_message.
     * If not, then clear the channel and set queue_message and schedule_message to null
     * @returns
     */
    EnsureQueueSafe(): Promise<void> {
        return this.display_channel.messages
            .fetchPinned()
            .then((messages) =>
                messages.filter((msg) => msg.author === this.client.user)
            )
            .then((messages) => {
                if (messages.size === 0) {
                    this.queue_message = null;
                    this.schedule_message = null;
                } else if (messages.size !== 2) {
                    messages.forEach((message) => message.delete());
                    messages.clear();
                    this.queue_message = null;
                    this.schedule_message = null;
                }
            });
    }

    /**
     * Updates the queue text. Called when queue is open or closed, or when someone joins or leaves the queue
     * @param queue
     * @param queue_members
     * @returns The queue_message, if a new one was created
     */
    async OnQueueUpdate(
        queue: HelpQueue,
        queue_members: MemberState[]
    ): Promise<Message<boolean> | undefined> {
        const message_text = this.GetQueueText(queue, queue_members);
        let embedColor = 0x000000;
        if (queue.is_open === true) {
            embedColor = 0x00ff00;
        } else {
            embedColor = 0xff0000;
        }
        const embedTable = new MessageEmbed()
            .setColor(embedColor)
            .setTimestamp();
        //TODO: .setAuthor({ name: 'BOB', iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png' })
        if (message_text.length === 1) {
            embedTable.setTitle(
                "Queue for " + queue.name + "\n" + message_text[0]
            );
        } else {
            embedTable.setTitle(
                "Queue for " + queue.name + "\n" + message_text[0]
            );
            embedTable.setDescription(message_text[1]);
        }
        const joinLeaveButtons = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("join " + queue.name)
                    .setEmoji("✅")
                    .setDisabled(!queue.is_open)
                    .setLabel("Join Queue")
                    .setStyle("SUCCESS")
            )
            .addComponents(
                new MessageButton()
                    .setCustomId("leave " + queue.name)
                    .setEmoji("❎")
                    .setDisabled(!queue.is_open)
                    .setLabel("Leave Queue")
                    .setStyle("DANGER")
            );
        const notifButtons = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("notif " + queue.name)
                    .setEmoji("🔔")
                    .setDisabled(queue.is_open)
                    .setLabel("Notify When Open")
                    .setStyle("PRIMARY")
            )
            .addComponents(
                new MessageButton()
                    .setCustomId("removeN " + queue.name)
                    .setEmoji("🔕")
                    .setDisabled(queue.is_open)
                    .setLabel("Remove Notifications")
                    .setStyle("PRIMARY")
            );

        // If queue_message exists, edit it
        // Else, send a new message
        if (this.queue_message === null) {
            this.EnsureQueueSafe();
            return await this.display_channel
                .send({
                    embeds: [embedTable],
                    components: [joinLeaveButtons, notifButtons],
                })
                .then((message) => {
                    this.queue_message = message;
                    return message;
                });
        } else {
            await this.queue_message
                .edit({
                    embeds: [embedTable],
                    components: [joinLeaveButtons, notifButtons],
                })
                .catch();
        }
    }
    /**
     * Updates the schedule_message
     * @param message_text
     * @returns The schedule_message, if a new one was created
     */
    async UpdateSchedule([message_text, update_time]: [string, Date]): Promise<
        Message<boolean> | undefined
    > {
        await this.setScheduleUpdateTime(update_time);
        const old_schedule_message = this.schedule_message;
        const scheduleEmbed = new MessageEmbed()
            .setTitle("Schedule")
            .setColor(0xfba736)
            .setDescription(message_text)
            .setTimestamp();
        // TODO: .setAuthor({ name: 'BOB', iconURL: 'https://i.postimg.cc/dVkg4XFf/BOB-pfp.png' })
        if (this.schedule_message === null) {
            await this.EnsureQueueSafe();
            await this.display_channel
                .send({
                    embeds: [scheduleEmbed],
                })
                .then((message) => {
                    this.schedule_message = message;
                });
        } else {
            await this.schedule_message
                .edit({
                    embeds: [scheduleEmbed],
                })
                .catch();
        }
        if (
            old_schedule_message !== this.schedule_message &&
            this.schedule_message !== null
        ) {
            return this.schedule_message;
        }
    }
}

export class HelpQueue {
    private queue: MemberState[] = [];
    readonly name: string;
    private display_manager: HelpQueueDisplayManager;
    private member_state_manager: MemberStateManager;
    private helpers: Set<GuildMember> = new Set();
    private notif_queue: Set<GuildMember> = new Set();

    constructor(
        name: string,
        display_manager: HelpQueueDisplayManager,
        member_state_manager: MemberStateManager
    ) {
        this.name = name;
        this.display_manager = display_manager;
        this.member_state_manager = member_state_manager;
    }

    get length(): number {
        return this.queue.length;
    }

    get is_open(): boolean {
        return this.helpers.size > 0;
    }

    Has(member: GuildMember): boolean {
        return (
            this.queue.find((queue_member) => queue_member.member === member) !==
            undefined
        );
    }

    get helpers_set(): Set<GuildMember> {
        return this.helpers;
    }

    get update_time(): Date {
        return this.display_manager.update_time;
    }

    /**
     * Removes all people from this queue
     */
    async Clear(): Promise<void> {
        this.queue.forEach((member) => member.TryRemoveFromQueue(this));
        this.queue = [];
        await this.UpdateDisplay();
    }

    /**
     * Updates the queue_message
     * @returns The queue_message if a new one was created
     */
    async UpdateDisplay(): Promise<Message<boolean> | undefined> {
        return await this.display_manager.OnQueueUpdate(this, this.queue);
    }

    /**
     * Updates the schedule_message to display the string `ScheduleMessage`
     * @param ScheduleMessage
     * @returns The schedule_message if a new one was created
     */
    async UpdateSchedule(
        ScheduleMessage: [string, Date]
    ): Promise<Message<boolean> | undefined> {
        return await this.display_manager.UpdateSchedule(ScheduleMessage);
    }

    /**
     * Ensure the queue is sage
     */
    async EnsureQueueSafe(): Promise<void> {
        await this.display_manager.EnsureQueueSafe();
    }

    /**
     * Adds a Helper to the list of available helpers for this queue. Calls `Notify()` if `mute_notifs` is false
     * @param member
     * @param mute_notifs
     */
    async AddHelper(member: GuildMember, mute_notifs: boolean): Promise<void> {
        if (this.helpers.has(member)) {
            console.warn(
                `Queue ${this.name} already has helper ${member.user.username}. Ignoring call to AddHelper`
            );
            return;
        }
        this.helpers.add(member);

        // if helper list size goes from 1, means queue just got open.
        // when it goes from 2 to 1, not a possible case since you can't press the notif button unless the queue is closed
        // hence, in that case, there is no-one in the notif_queue, and hence no-one is messaged
        if (this.helpers.size === 1 && mute_notifs !== true) {
            await this.NotifyUsers();
        }
        await this.UpdateDisplay();
    }

    /**
     * Removes a Helper to the list of available helpers for this queue.
     * @param member
     */
    async RemoveHelper(member: GuildMember): Promise<void> {
        if (!this.helpers.has(member)) {
            console.warn(
                `Queue ${this.name} does not have helper ${member.user.username}. Ignoring call to RemoveHelper`
            );
            return;
        }
        this.helpers.delete(member);
        await this.UpdateDisplay();
    }

    /**
     * Adds `member` to this queue
     * @param member
     */
    async Enqueue(member: GuildMember): Promise<void> {
        const user_state = this.member_state_manager.GetMemberState(member);
        user_state.TryAddToQueue(this);
        this.queue.push(user_state);
        if (this.queue.length === 1) {
            // The queue went from having 0 people to having 1.
            // Notify helpers of this queue that someone has joined.
            await Promise.all(
                Array.from(this.helpers).map((helper) =>
                    helper.send(
                        `Heads up! <@${member.user.id}> has joined "${this.name}".`
                    )
                )
            );
        }
        await this.UpdateDisplay();
    }

    /**
     * Removes `member` from this queue
     * @param member
     */
    async Remove(member: GuildMember): Promise<void> {
        // Removes a user from this queue, called by /leave
        const user_state = this.member_state_manager.GetMemberState(member);
        user_state.TryRemoveFromQueue(this);
        this.queue = this.queue.filter(
            (waiting_user) => waiting_user != user_state
        );

        await this.UpdateDisplay();
    }

    /**
     * Removes the member at the front of this queue
     * @returns `MemberState` object associated with the member at the front of the queue
     */
    async Dequeue(): Promise<MemberState> {
        // Removes next user from this queue, called by /next
        const user_state = this.queue.shift();
        if (user_state === undefined) {
            throw new UserError("Empty queue");
        }
        user_state.TryRemoveFromQueue(this);

        await this.UpdateDisplay();
        return user_state;
    }

    /**
     * Adds `member` to the notification queue for this queue
     * @param member
     */
    async AddToNotifQueue(member: GuildMember): Promise<void> {
        //Adds member to notification queue
        this.notif_queue.add(member);
    }

    /**
     * Removes `member` from the notification queue for this queue
     * @param member
     */
    RemoveFromNotifQueue(member: GuildMember): void {
        //Adds member to notification queue
        this.notif_queue.delete(member);
    }

    /**
     * Notifys all the users in the notification queue for this queue
     */
    async NotifyUsers(): Promise<void> {
        //Notifys the users in the notification queue that the queue is now open
        if (this.notif_queue.size === 0) return;
        this.notif_queue.forEach((member) =>
            member.send("Hey! The `" + this.name + "` queue is now open!")
        );
        this.notif_queue.clear();
    }

    /**
     * @returns the person at the front of this queue
     */
    Peek(): MemberState | undefined {
        if (this.queue.length === 0) {
            return undefined;
        } else {
            return this.queue[0];
        }
    }
}
