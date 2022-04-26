import { HelpQueue, HelpQueueDisplayManager } from "../src/queue"
import { expect } from "chai"
import "mocha"
import { mock, verify, instance, anything, when, anyString } from 'ts-mockito'
import { Message, TextChannel, Collection, MessageManager, ClientUser, Client, GuildMember } from "discord.js"
import { MemberState, MemberStateManager } from "../src/member_state_manager"
import { resolvableInstance } from "./resolveable_instance"
import chaiAsPromised from 'chai-as-promised'
import chai from 'chai'

chai.use(chaiAsPromised)

describe('Queue Display Manager', () => {
    let mock_channel: TextChannel
    let channel_instance: TextChannel
    let mock_message_manager: MessageManager
    let display_manager: HelpQueueDisplayManager
    beforeEach(() => {
        mock_channel = mock<TextChannel>()
        mock_message_manager = mock<MessageManager>()
        channel_instance = instance(mock_channel)
        channel_instance.messages = instance(mock_message_manager)
    })

    it('should send and pin messages', async () => {
        display_manager = new HelpQueueDisplayManager(mock(), channel_instance)
        const user1 = mock<MemberState>()
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Mock read-only value
        instance(user1)['member'] = instance(mock())
        user1.member.user = instance(mock())

        const pinned_messages = new Collection<string, Message>()
        const mock_message = mock<Message>()
        when(mock_message_manager.fetchPinned())
            .thenResolve(pinned_messages)
        when(mock_channel.send(anything()))
            .thenResolve(resolvableInstance(mock_message))
        when(mock_message.pin())
            .thenResolve(resolvableInstance(mock_message))
        return display_manager.OnQueueUpdate(instance(mock()), [user1]).then(() => {
            verify(mock_channel.send(anything())).once()
            verify(mock_message.pin()).once()
        })
    })

    it('should prune and create messages', async () => {
        const bot_user = mock<ClientUser>()
        bot_user.id = 'foo bar'
        const mock_client = mock<Client>()
        instance(mock_client).user = bot_user

        const pinned_msg_1 = mock<Message>()
        const pinned_msg_2 = mock<Message>()
        const pinned_msg_3 = mock<Message>()
        instance(pinned_msg_1).author = bot_user
        instance(pinned_msg_2).author = mock()
        instance(pinned_msg_3).author = bot_user

        const pinned_messages = new Collection<string, Message>()
        pinned_messages.set('1', instance(pinned_msg_1))
        pinned_messages.set('2', instance(pinned_msg_2))
        pinned_messages.set('3', instance(pinned_msg_3))

        display_manager = new HelpQueueDisplayManager(instance(mock_client), channel_instance)

        when(mock_message_manager.fetchPinned())
            .thenResolve(pinned_messages)
        when(mock_channel.send(anything()))
            .thenResolve(resolvableInstance(mock()))

        return display_manager.OnQueueUpdate(instance(mock()), []).then(() => {
            verify(pinned_msg_1.delete()).once()
            verify(pinned_msg_2.delete()).never()
            verify(pinned_msg_2.edit(anyString())).never()
            verify(pinned_msg_3.delete()).once()
            verify(mock_channel.send(anything())).once()
        })
    })

    it('should edit messages', async () => {
        const bot_user = mock<ClientUser>()
        bot_user.id = 'foo bar'
        const mock_client = mock<Client>()
        instance(mock_client).user = bot_user

        const pinned_msg_1 = mock<Message>()
        const pinned_msg_2 = mock<Message>()
        instance(pinned_msg_1).author = bot_user
        instance(pinned_msg_2).author = mock()

        const pinned_messages = new Collection<string, Message>()
        pinned_messages.set('1', instance(pinned_msg_1))
        pinned_messages.set('2', instance(pinned_msg_2))

        display_manager = new HelpQueueDisplayManager(instance(mock_client), channel_instance)

        when(mock_message_manager.fetchPinned())
            .thenResolve(pinned_messages)
        when(pinned_msg_1.edit(anyString()))
            .thenResolve(resolvableInstance(pinned_msg_1))


        return display_manager.OnQueueUpdate(instance(mock()), []).then(() => {
            verify(pinned_msg_1.delete()).never()
            verify(pinned_msg_1.edit(anyString())).once()
            verify(pinned_msg_2.delete()).never()
            verify(mock_channel.send(anything())).never()
        })
    })

    it('should pass along Discord API errors', async () => {
        display_manager = new HelpQueueDisplayManager(mock(), channel_instance)
        const pinned_messages = new Collection<string, Message>()
        when(mock_message_manager.fetchPinned())
            .thenResolve(pinned_messages)
        when(mock_channel.send(anything()))
            .thenReject(new Error('Oh noez!'))

        await expect(display_manager.OnQueueUpdate(instance(mock()), [])).to.eventually.be.rejectedWith('Oh noez!')
    })
})

describe('Help Queue', () => {
    const queue_name = 'Example Queue'
    let queue: HelpQueue
    let mock_display_manager: HelpQueueDisplayManager
    let member_state_manager: MemberStateManager

    beforeEach(() => {
        member_state_manager = new MemberStateManager()
        mock_display_manager = mock<HelpQueueDisplayManager>()
        when(mock_display_manager.OnQueueUpdate(anything(), anything())).thenResolve()
        queue = new HelpQueue(queue_name, instance(mock_display_manager), member_state_manager)
    })

    it('should enqueue and dequeue', async () => {
        const user1 = mock<GuildMember>()
        const user2 = mock<GuildMember>()
        const user3 = mock<GuildMember>()

        await queue.Enqueue(user1)
        await queue.Enqueue(user2)
        await queue.Enqueue(user3)

        await expect(queue.Dequeue()).to.eventually.satisfy((m: MemberState) => m.member == user1)
        await expect(queue.Dequeue()).to.eventually.satisfy((m: MemberState) => m.member == user2)
        await expect(queue.Dequeue()).to.eventually.satisfy((m: MemberState) => m.member == user3)

        await expect(queue.Dequeue()).to.eventually.be.rejectedWith('Empty')
    })

    it('should allow removals', async () => {
        const user1 = mock<GuildMember>()
        const user2 = mock<GuildMember>()
        const user3 = mock<GuildMember>()

        await queue.Enqueue(user1)
        await queue.Enqueue(user2)
        await queue.Enqueue(user3)

        await queue.Remove(user2)

        await expect(queue.Dequeue()).to.eventually.satisfy((m: MemberState) => m.member == user1)
        await expect(queue.Dequeue()).to.eventually.satisfy((m: MemberState) => m.member == user3)
        await expect(queue.Dequeue()).to.eventually.be.rejectedWith('Empty')
    })

    it('should not allow a user to be queued twice', async () => {
        const user1 = mock<GuildMember>()
        const user2 = mock<GuildMember>()

        await queue.Enqueue(user1)
        await queue.Enqueue(user2)

        await expect(queue.Enqueue(user1)).to.eventually.be.rejectedWith('Already')
        await expect(queue.Enqueue(user2)).to.eventually.be.rejectedWith('Already')

        await queue.Dequeue()
        await queue.Dequeue()

        await expect(queue.Enqueue(user1)).to.not.eventually.be.rejectedWith('Already')
        return expect(queue.Enqueue(user2)).to.not.eventually.rejectedWith('Already')
    })

    it('should not allow a user to join multiple queues on same server', async () => {
        const queue_2 = new HelpQueue('Queue 2', mock(), member_state_manager)
        const user1 = mock<GuildMember>()

        await expect(queue.Enqueue(user1)).to.not.eventually.be.rejectedWith()
        await expect(queue_2.Enqueue(user1)).to.eventually.be.rejectedWith('Already')
        await expect(queue_2.Remove(user1)).to.eventually.be.rejectedWith('Not in')
        await expect(queue_2.Dequeue()).to.eventually.be.rejectedWith('Empty')
        await expect(queue.Dequeue()).to.eventually.satisfy((m: MemberState) => m.member == user1)
        await expect(queue_2.Enqueue(user1)).to.not.eventually.be.rejectedWith()
        await expect(queue_2.Dequeue()).to.eventually.satisfy((m: MemberState) => m.member == user1)
    })

    it('should update the display', async () => {
        const user1 = mock<GuildMember>()
        const user2 = mock<GuildMember>()

        await queue.Enqueue(user1)
        await queue.Enqueue(user2)
        await queue.Dequeue()
        // Queue actions that result in user errors should not update the display
        await expect(queue.Enqueue(user2)).to.eventually.be.rejectedWith('Already')
        await expect(queue.Remove(user1)).to.eventually.be.rejectedWith('Not in')
        await queue.Remove(user2)
        await expect(queue.Dequeue()).to.eventually.be.rejectedWith('Empty')
        verify(mock_display_manager.OnQueueUpdate(anything(), anything())).times(4)
    })
})