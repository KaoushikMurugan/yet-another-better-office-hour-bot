import { Client, GuildMember, MessageActionRow, MessageButton, TextChannel } from "discord.js";
import { MemberState, MemberStateManager } from "./member_state_manager";
import { UserError } from "./user_action_error";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsciiTable = require('ascii-table');

/**********************************************************************************
 * This file defines the HelpQueueDisplayManager and the Help Queue class
 * HelpQueueDisplayManager manages the message that's in the #queue channels
 * HelpQueue impliments a queue for each channel and also various functions for it
 * .setRequired defines where the argument is required or ont
 **********************************************************************************/

export class HelpQueueDisplayManager {
    private client: Client
    private display_channel: TextChannel

    constructor(client: Client, display_channel: TextChannel) {
        this.client = client
        this.display_channel = display_channel
    }

    // Returns a table of the list of people in queue in text form that can be used in a message
    private GetQueueText(queue: HelpQueue, queue_members: MemberState[]): string {
        const quant_prase = queue.length == 1 ? 'is 1 person' : `are ${queue.length} people`
        const status_line = `The queue is **${queue.is_open ? 'OPEN' : 'CLOSED'}**. There ${quant_prase} in the queue.\n`
        if (queue.length > 0) {
            const table = new AsciiTable()
            table.setHeading('Position', 'Username', 'Nickname')
            queue_members.forEach((state, idx) => table.addRow(idx + 1, state.member.user.tag, state.member.user.username))
            return status_line + '```\n' + table.toString() + '\n```'
        }
        return status_line
    }

    // Updates the queue text. Called when queue is open or closed, or when someone joins or leaves the queue
    OnQueueUpdate(queue: HelpQueue, queue_members: MemberState[]): Promise<void> {
        return this.display_channel.messages.fetchPinned()
            .then(messages => messages.filter(msg => msg.author == this.client.user))
            .then(messages => {
                if (messages.size > 1) {
                    messages.forEach(message => message.delete())
                    messages.clear()
                }
                const message_text = this.GetQueueText(queue, queue_members)
                const buttons = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setCustomId('join ' + queue.name)
                            .setEmoji('✅')
                            .setDisabled(!queue.is_open)
                            .setLabel('Join Queue')
                            .setStyle('SUCCESS')
                    )
                    .addComponents(
                        new MessageButton()
                            .setCustomId('leave ' + queue.name)
                            .setEmoji('❎')
                            .setDisabled(!queue.is_open)
                            .setLabel('Leave Queue')
                            .setStyle('DANGER')
                    )
                // If the bot has already sent a message, edit it
                // Else, send a new message
                if (messages.size == 0) {
                    return this.display_channel.send({
                        content: message_text,
                        components: [buttons]
                    }).then(message => message.pin())
                } else {
                    return messages.first()?.edit({
                        content: message_text,
                        components: [buttons]
                    })
                }
            }).then(() => undefined)

    }
}

export class HelpQueue {
    private queue: MemberState[] = []
    readonly name: string
    private display_manager: HelpQueueDisplayManager
    private member_state_manager: MemberStateManager
    private helpers: Set<GuildMember> = new Set()

    constructor(name: string, display_manager: HelpQueueDisplayManager, member_state_manager: MemberStateManager) {
        this.name = name
        this.display_manager = display_manager
        this.member_state_manager = member_state_manager
    }

    get length(): number {
        return this.queue.length
    }

    get is_open(): boolean {
        return this.helpers.size > 0
    }

    Has(member: GuildMember): boolean {
        return this.queue.find(queue_member => queue_member.member == member) !== undefined
    }

    async Clear(): Promise<void> {
        this.queue.forEach(member => member.TryRemoveFromQueue(this))
        this.queue = []
        await this.UpdateDisplay()
    }

    async UpdateDisplay(): Promise<void> {
        await this.display_manager.OnQueueUpdate(this, this.queue)
    }
    // Adds a Helper to the list of available helpers for this queue. called by /start
    async AddHelper(member: GuildMember): Promise<void> {
        if (this.helpers.has(member)) {
            console.warn(`Queue ${this.name} already has helper ${member.user.username}. Ignoring call to AddHelper`)
            return
        }
        this.helpers.add(member)
        await this.UpdateDisplay()
    }
    // Removes a Helper to the list of available helpers for this queue. called by /stop
    async RemoveHelper(member: GuildMember): Promise<void> {
        if (!this.helpers.has(member)) {
            console.warn(`Queue ${this.name} does not have helper ${member.user.username}. Ignoring call to RemoveHelper`)
            return
        }
        this.helpers.delete(member)
        await this.UpdateDisplay()
    }
    // Adds a user to this queue
    async Enqueue(member: GuildMember): Promise<void> {
        const user_state = this.member_state_manager.GetMemberState(member)
        user_state.TryAddToQueue(this)
        this.queue.push(user_state)

        if (this.queue.length == 1) {
            // The queue went from having 0 people to having 1.
            // Notify helpers of this queue that someone has joined.
            await Promise.all(
                Array.from(this.helpers)
                    .map(helper => helper.send(`Heads up! <@${member.user.id}> has joined "${this.name}".`)))
        }

        await this.UpdateDisplay()
    }
    async Remove(member: GuildMember): Promise<void> {
        // Removes a user from this queue, called by /leave
        const user_state = this.member_state_manager.GetMemberState(member)
        user_state.TryRemoveFromQueue(this)
        this.queue = this.queue.filter(waiting_user => waiting_user != user_state)

        await this.UpdateDisplay()
    }
    async Dequeue(): Promise<MemberState> {
        // Removes next user from this queue, called by /next
        const user_state = this.queue.shift()
        if (user_state === undefined) {
            throw new UserError('Empty queue')
        }
        user_state.TryRemoveFromQueue(this)

        await this.UpdateDisplay()
        return user_state
    }
    // Returns the person at the front of this queue
    Peek(): MemberState | undefined {
        if (this.queue.length == 0) {
            return undefined
        } else {
            return this.queue[0]
        }
    }
}