import { Client, GuildMember, TextChannel } from "discord.js";
import { MemberState, MemberStateManager } from "./member_state_manager";
import { UserError } from "./user_action_error";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsciiTable = require('ascii-table');

export class HelpQueueDisplayManager {
    private client: Client
    private display_channel: TextChannel

    constructor(client: Client, display_channel: TextChannel) {
        this.client = client
        this.display_channel = display_channel
    }

    private GetQueueText(queue: HelpQueue, queue_members: MemberState[]): string {
        const quant_prase =  queue.length == 1 ? 'is 1 person' : `are ${queue.length} people`
        const status_line = `The queue is **${queue.is_open ? 'OPEN' : 'CLOSED'}**. There ${quant_prase} in the queue.\n`
        if(queue.length > 0) {
            const table = new AsciiTable()
            table.setHeading('Position', 'Name')
            queue_members.forEach((state, idx) => table.addRow(idx + 1, state.member.user.username))
            return status_line + '```\n' + table.toString() + '\n```'
        }
        return status_line
    }

    OnQueueUpdate(queue: HelpQueue, queue_members: MemberState[]): Promise<void> {
        return this.display_channel.messages.fetchPinned()
            .then(messages => messages.filter(msg => msg.author == this.client.user))
            .then(messages => {
                if (messages.size > 1) {
                    messages.forEach(message => message.delete())
                    messages.clear()
                }
                const message_text = this.GetQueueText(queue, queue_members)
                if (messages.size == 0) {
                    return this.display_channel.send(message_text).then(message => message.pin())
                } else {
                    return messages.first()?.edit(message_text)
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
        this.queue.forEach(member => member.TryRemoveFromQueue())
        this.queue = []
        await this.UpdateDisplay()
    }

    async UpdateDisplay(): Promise<void> {
        await this.display_manager.OnQueueUpdate(this, this.queue)
    }

    async AddHelper(member: GuildMember): Promise<void> {
        if (this.helpers.has(member)) {
            console.warn(`Queue ${this.name} already has helper ${member.user.username}. Ignoring call to AddHelper`)
            return
        }
        this.helpers.add(member)
        await this.UpdateDisplay()
    }

    async RemoveHelper(member: GuildMember): Promise<void> {
        if (!this.helpers.has(member)) {
            console.warn(`Queue ${this.name} does not have helper ${member.user.username}. Ignoring call to RemoveHelper`)
            return
        }
        this.helpers.delete(member)
        await this.UpdateDisplay()
    }

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
        const user_state = this.member_state_manager.GetMemberState(member)
        user_state.TryRemoveFromQueue(this)
        this.queue = this.queue.filter(waiting_user => waiting_user != user_state)

        await this.UpdateDisplay()
    }

    async Dequeue(): Promise<MemberState> {
        const user_state = this.queue.shift()
        if(user_state === undefined) {
            throw new UserError('Empty queue')
        }
        user_state.TryRemoveFromQueue()

        await this.UpdateDisplay()
        return user_state
    }

    Peek(): MemberState | undefined {
        if(this.queue.length == 0) {
            return undefined
        } else {
            return this.queue[0]
        }
    }
}