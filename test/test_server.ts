/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import "mocha"
import chai, { expect } from 'chai'
import chaiAsPromised from "chai-as-promised"
import { AttendingServer } from "../src/server"
import { anyString, anything, deepEqual, instance, mock, spy, verify, when } from "ts-mockito"
import { Permissions, CategoryChannel, Client, Collection, Guild, GuildChannelManager, GuildMember, GuildMemberManager, MessageManager, NewsChannel, Role, RoleManager, StageChannel, StoreChannel, TextChannel, VoiceChannel, GuildMemberRoleManager } from "discord.js"
import { resolvableInstance } from "./resolveable_instance"
import { Matcher } from "ts-mockito/lib/matcher/type/Matcher"
import { HelpQueue } from "../src/queue"
import { MemberState } from "../src/member_state_manager"

chai.use(chaiAsPromised)

type AnyChannel = TextChannel | VoiceChannel | CategoryChannel | NewsChannel | StoreChannel | StageChannel

class NotUndefinedMatcher extends Matcher {
    constructor() {
        super()
    }

    public match(value: any): boolean {
        return value !== undefined
    }

    public toString(): string {
        return "notUndefined();"
    }
}
function notUndefined(): any {
    return new NotUndefinedMatcher() as any;
}


describe('AttendingServer', () => {
    let mock_guild: Guild
    let mock_roles_manager: RoleManager
    let mock_channel_manager: GuildChannelManager
    let guild_instance: Guild
    let mock_permissions: Permissions
    let mock_owner: GuildMember
    let mock_client: Client
    let mock_member_manager: GuildMemberManager

    beforeEach(() => {
        mock_guild = mock()
        mock_roles_manager = mock()
        mock_channel_manager = mock()
        guild_instance = instance(mock_guild)
        guild_instance.roles = instance(mock_roles_manager)
        guild_instance.channels = instance(mock_channel_manager)
        mock_member_manager = mock<GuildMemberManager>()
        guild_instance.members = instance(mock_member_manager)
        when(mock_member_manager.fetch()).thenResolve(new Collection())

        const mock_me = mock<GuildMember>()
        mock_permissions = mock<Permissions>()
        when(mock_permissions.has('ADMINISTRATOR')).thenReturn(true)
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_me)['permissions'] = instance(mock_permissions)
        // @ts-ignore Overwrite readonly value for testing
        guild_instance['me'] = instance(mock_me)

        mock_owner = mock<GuildMember>()
        when(mock_owner.send(anyString())).thenResolve(resolvableInstance(mock()))
        when(mock_guild.fetchOwner()).thenResolve(resolvableInstance(mock_owner))

        guild_instance.name = 'Mock server'

        mock_client = mock()
    })

    it('should clear single queues', async () => {
        // Set up starting channels
        const starting_channels = new Collection<string, AnyChannel>()
        // Office hours category
        const mock_category_channel = mock<CategoryChannel>()
        instance(mock_category_channel).name = 'office hours'
        instance(mock_category_channel).type = 'GUILD_CATEGORY'
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_category_channel)['children'] = new Collection()
        starting_channels.set('1', instance(mock_category_channel))
        // Queue channel for office hours
        const mock_queue_channel = mock<TextChannel>()
        instance(mock_queue_channel).name = 'queue'
        instance(mock_queue_channel).type = 'GUILD_TEXT'
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_queue_channel)['parent'] = instance(mock_category_channel)
        const mock_message_manager = mock<MessageManager>()
        instance(mock_queue_channel).messages = instance(mock_message_manager)
        when(mock_message_manager.fetchPinned()).thenResolve(new Collection())
        when(mock_queue_channel.send(anyString())).thenResolve(resolvableInstance(mock()))
        // Parent/child relationship
        starting_channels.set('2', instance(mock_queue_channel))
        instance(mock_category_channel).children.set('1', instance(mock_queue_channel))

        // Set up starting roles
        const starting_roles = new Collection<string, Role>()
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_roles_manager)['cache'] = starting_roles
        // OH Queue role
        const mock_oh_role = mock<Role>()
        instance(mock_oh_role).name = 'office hours'
        starting_roles.set('1', instance(mock_oh_role))
        // Staff role
        const mock_staff_role = mock<Role>()
        instance(mock_staff_role).name = 'Staff'
        starting_roles.set('2', instance(mock_oh_role))
        // Let the server create missing roles
        when(mock_roles_manager.create(anything())).thenResolve(resolvableInstance(mock()))

        // Let the server discover starting roles & channels
        when(mock_channel_manager.fetch()).thenResolve(starting_channels)
        when(mock_roles_manager.fetch()).thenResolve(starting_roles)

        const server = await AttendingServer.Create(instance(mock_client), guild_instance)
        const user1 = mock<GuildMember>()
        const user2 = mock<GuildMember>()
        const user2_roles = new Collection<string, Role>()
        const mock_user2_role_manager = mock<RoleManager>()
        // @ts-ignore Overwite readonly value for testing
        instance(mock_user2_role_manager)['cache'] = user2_roles
        user2_roles.set('1', instance(mock_staff_role))
        user2_roles.set('2', instance(mock_oh_role))
        // @ts-ignore Overwite readonly value for testing
        instance(user2)['roles'] = instance(mock_user2_role_manager)

        await server.AddHelper(instance(user2))
        await server.EnqueueUser('office hours', instance(user1))
        await server.ClearQueue(instance(mock_category_channel))
        await expect(server.Dequeue(instance(user2))).to.eventually.be.rejectedWith('There is no one')
        await server.EnqueueUser('office hours', instance(user1))
        await expect(server.Dequeue(instance(user2))).to.eventually.satisfy((m: MemberState) => m.member == instance(user1))

        const fake_queue = mock<CategoryChannel>()
        fake_queue.name = 'foobar'
        await expect(server.ClearQueue(instance(fake_queue))).to.be.rejectedWith('There is not a queue')
    })

    it('should leave servers if it doesnt have admin permissions', async () => {
        when(mock_permissions.has('ADMINISTRATOR')).thenReturn(false)

        await expect(AttendingServer.Create(instance(mock_client), guild_instance)).to.eventually.be.rejectedWith('Invalid permissions.')
        verify(mock_guild.leave()).once()
        // The owner of the guild should get a message notifying them of the error
        verify(mock_owner.send(anyString())).once()
    })

    it('should handle user actions on multiple queues', async () => {
        // Set up starting channels
        const starting_channels = new Collection<string, AnyChannel>()
        // 1 - The 'foo' queue
        const foo_category_channel = mock<CategoryChannel>()
        instance(foo_category_channel).name = 'foo'
        instance(foo_category_channel).type = 'GUILD_CATEGORY'
        
        const foo_queue_channel = mock<TextChannel>()
        instance(foo_queue_channel).name = 'queue'
        instance(foo_queue_channel).type = 'GUILD_TEXT'
        when(foo_queue_channel.send(anyString())).thenResolve(resolvableInstance(mock()))

        const foo_queue_message_manager = mock<MessageManager>()
        instance(foo_queue_channel).messages = instance(foo_queue_message_manager)
        when(foo_queue_message_manager.fetchPinned()).thenResolve(new Collection())

        // @ts-ignore Overwrite readonly value for testing
        instance(foo_category_channel)['children'] = new Collection()
        instance(foo_category_channel).children.set('1', instance(foo_queue_channel))

        starting_channels.set('1', instance(foo_category_channel))

        // 2 - the 'bar' queue
        const bar_category_channel = mock<CategoryChannel>()
        instance(bar_category_channel).name = 'bar'
        instance(bar_category_channel).type = 'GUILD_CATEGORY'
        
        const bar_queue_channel = mock<TextChannel>()
        instance(bar_queue_channel).name = 'queue'
        instance(bar_queue_channel).type = 'GUILD_TEXT'
        when(bar_queue_channel.send(anyString())).thenResolve(resolvableInstance(mock()))

        const bar_queue_message_manager = mock<MessageManager>()
        instance(bar_queue_channel).messages = instance(bar_queue_message_manager)
        when(bar_queue_message_manager.fetchPinned()).thenResolve(new Collection())

        // @ts-ignore Overwrite readonly value for testing
        instance(bar_category_channel)['children'] = new Collection()
        instance(bar_category_channel).children.set('1', instance(bar_queue_channel))

        starting_channels.set('2', instance(bar_category_channel))

        // Set up starting roles
        const starting_roles = new Collection<string, Role>()
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_roles_manager)['cache'] = starting_roles

        // 1 - for the 'foo' queue
        const foo_role = mock<Role>()
        instance(foo_role).name = 'foo'
        starting_roles.set('1', instance(foo_role))

        // 2 - for the 'bar' queue
        const bar_role = mock<Role>()
        instance(bar_role).name = 'bar'
        starting_roles.set('2', instance(bar_role))

        // Let the server discover starting roles & channels
        when(mock_channel_manager.fetch()).thenResolve(starting_channels)
        when(mock_roles_manager.fetch()).thenResolve(starting_roles)

        const server = await AttendingServer.Create(instance(mock_client), guild_instance)

        function createMockUser(id: number, roles: Role[] = []): GuildMember {
            const user = mock<GuildMember>()
            const role_manager = mock<RoleManager>()
            // @ts-ignore Overwrite readonly value for testing
            instance(role_manager)['cache'] = new Collection()
            roles.forEach(role => instance(role_manager).cache.set(
                instance(role_manager).cache.size.toString(), instance(role)
            ))
            // @ts-ignore Overwrite readonly value for testing
            instance(user)['roles'] = instance(role_manager)
            // @ts-ignore Overwrite readonly value for testing
            instance(user)['id'] = id
            instance(user).user = instance(mock())
            instance(user).user.id = `user${id}`
            instance(user).user.username = `user${id}`

            return user
        }
        
        const user1 = createMockUser(1, [foo_role])
        const user2 = createMockUser(2, [foo_role, bar_role])
        const user3 = createMockUser(3)
        const user4 = createMockUser(4)

        // Queues are closed, users can't join
        await expect(server.EnqueueUser('bar', instance(user3))).to.eventually.be.rejectedWith('closed')
        await expect(server.EnqueueUser('foo', instance(user1))).to.eventually.be.rejectedWith('closed')
        // Queues are closed, helpers can't dequeue
        await expect(server.Dequeue(instance(user1))).to.eventually.be.rejectedWith('started helping yet')
        await expect(server.Dequeue(instance(user2))).to.eventually.be.rejectedWith('started helping yet')
        // Open the 'foo' queue (user1 helping)
        await expect(server.AddHelper(instance(user1))).to.eventually.not.be.rejectedWith()
        // 'bar' should still be closed
        await expect(server.EnqueueUser('bar', instance(user3))).to.eventually.be.rejectedWith('closed')
        // Add users to 'foo' queue
        await expect(server.EnqueueUser('foo', instance(user2))).to.eventually.not.be.rejectedWith()
        await expect(server.EnqueueUser('foo', instance(user3))).to.eventually.not.be.rejectedWith()
        await expect(server.EnqueueUser('foo', instance(user4))).to.eventually.not.be.rejectedWith()
        // User 2 should not be able to start helping while they are in the 'foo' queue
        await expect(server.AddHelper(instance(user2))).to.eventually.be.rejectedWith('while in a queue')
        // Dequeue user 2 from 'foo'
        await expect(server.Dequeue(instance(user1))).to.eventually.satisfy((m: MemberState) => m.member == instance(user2))
        // User 2 should be able to start helping. Opens 'bar' queue and adds helper to 'foo' queue
        await expect(server.AddHelper(instance(user2))).to.eventually.not.be.rejectedWith()
        // Have user 2 dequeue user 3 from 'foo'
        await expect(server.Dequeue(instance(user2))).to.eventually.satisfy((m: MemberState) => m.member == instance(user3))
        // Add user 3 to 'bar' queue
        await expect(server.EnqueueUser('bar', instance(user3))).to.eventually.not.be.rejectedWith()
        // Have user 1 dequeue user 4 from 'foo'
        await expect(server.Dequeue(instance(user1))).to.eventually.satisfy((m: MemberState) => m.member == instance(user4))
        // User 4 re-joins 'foo' after a short break
        await new Promise(resolve => setTimeout(resolve, 3))
        await expect(server.EnqueueUser('foo', instance(user4))).to.eventually.not.be.rejectedWith()
        // User 2 can pull from either 'foo' or 'bar', but user 3 joined 'bar' before user 4 joined 'foo'
        await expect(server.Dequeue(instance(user2))).to.eventually.satisfy((m: MemberState) => m.member == instance(user3))
        // Re-queue user3 and clear all of the queues
        await expect(server.EnqueueUser('bar', instance(user3))).to.eventually.not.be.rejectedWith()
        await expect(server.ClearAllQueues()).to.not.eventually.be.rejectedWith()
        await expect(server.EnqueueUser('foo', instance(user3))).to.eventually.not.be.rejectedWith()
        await expect(server.EnqueueUser('foo', instance(user4))).to.eventually.not.be.rejectedWith()
        // Have user1 dequeue user3 by name
        await expect(server.Dequeue(instance(user1), null, instance(user3)))
            .to.eventually.satisfy((m: MemberState) => m.member == instance(user3))
        // User1 should not be able to dequeue user3 now that they are not in a queue
        await expect(server.Dequeue(instance(user1), null, instance(user3))).to.eventually.be.rejectedWith('not in a queue')
        // User1 should not be able to dequeue from 'bar'
        await expect(server.EnqueueUser('bar', instance(user3))).to.eventually.not.be.rejectedWith()
        await expect(server.Dequeue(instance(user1), instance(bar_category_channel))).to.eventually.be.rejectedWith('are not registered as')
        await expect(server.Dequeue(instance(user1), null, instance(user3))).to.eventually.be.rejectedWith('are not registered as')
        // User1 should not be able to dequeue from an unknown queue
        const fake_queue = mock<CategoryChannel>()
        instance(fake_queue).name = 'fake queue'
        await expect(server.Dequeue(instance(user1), instance(fake_queue))).to.eventually.be.rejectedWith('There is not a queue')
        // User2 should be able to dequeue from 'bar'
        await expect(server.Dequeue(instance(user2), instance(bar_category_channel)))
            .to.eventually.satisfy((m: MemberState) => m.member == instance(user3))
        // Close up shop
        await expect(server.RemoveHelper(instance(user1))).to.eventually.not.be.rejectedWith()
        await expect(server.RemoveHelper(instance(user2))).to.eventually.not.be.rejectedWith()
    })

    it('should handle user actions on a single queue', async () => {
        // Set up starting channels
        const starting_channels = new Collection<string, AnyChannel>()
        // Office hours category
        const mock_category_channel = mock<CategoryChannel>()
        instance(mock_category_channel).name = 'office hours'
        instance(mock_category_channel).type = 'GUILD_CATEGORY'
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_category_channel)['children'] = new Collection()
        starting_channels.set('1', instance(mock_category_channel))
        // Queue channel for office hours
        const mock_queue_channel = mock<TextChannel>()
        instance(mock_queue_channel).name = 'queue'
        instance(mock_queue_channel).type = 'GUILD_TEXT'
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_queue_channel)['parent'] = instance(mock_category_channel)
        const mock_message_manager = mock<MessageManager>()
        instance(mock_queue_channel).messages = instance(mock_message_manager)
        when(mock_message_manager.fetchPinned()).thenResolve(new Collection())
        when(mock_queue_channel.send(anyString())).thenResolve(resolvableInstance(mock()))
        // Parent/child relationship
        starting_channels.set('2', instance(mock_queue_channel))
        instance(mock_category_channel).children.set('1', instance(mock_queue_channel))

        // Set up starting roles
        const starting_roles = new Collection<string, Role>()
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_roles_manager)['cache'] = starting_roles
        // OH Queue role
        const mock_oh_role = mock<Role>()
        instance(mock_oh_role).name = 'office hours'
        starting_roles.set('1', instance(mock_oh_role))
        // Staff role
        const mock_staff_role = mock<Role>()
        instance(mock_staff_role).name = 'Staff'
        starting_roles.set('2', instance(mock_oh_role))
        // Let the server create missing roles
        when(mock_roles_manager.create(anything())).thenResolve(resolvableInstance(mock()))

        // Let the server discover starting roles & channels
        when(mock_channel_manager.fetch()).thenResolve(starting_channels)
        when(mock_roles_manager.fetch()).thenResolve(starting_roles)

        const server = await AttendingServer.Create(instance(mock_client), guild_instance)
        const user1 = mock<GuildMember>()
        const user2 = mock<GuildMember>()
        const user2_roles = new Collection<string, Role>()
        const mock_user2_role_manager = mock<RoleManager>()
        // @ts-ignore Overwite readonly value for testing
        instance(mock_user2_role_manager)['cache'] = user2_roles
        user2_roles.set('1', instance(mock_staff_role))
        // @ts-ignore Overwite readonly value for testing
        instance(user2)['roles'] = instance(mock_user2_role_manager)

        await expect(server.EnqueueUser('missing_queue', user1)).to.eventually.be.rejectedWith('There is not a queue')
        await expect(server.EnqueueUser('office hours', user1)).to.eventually.be.rejectedWith('closed')
        // Ensure staff can't help if they dont have any queues assigned
        await expect(server.AddHelper(instance(user2))).to.eventually.be.rejectedWith('any queue roles assigned')
        // Add a queue role and try again
        user2_roles.set('2', instance(mock_oh_role))
        // Spy on the queue object to verify it was notified of the helper
        expect(server['queues'].length).to.equal(1)
        const spied_queue = spy(server['queues'].find(() => true)) as HelpQueue
        // Open the queue
        await expect(server.AddHelper(instance(user2))).to.not.eventually.be.rejectedWith()
        verify(spied_queue.AddHelper(instance(user2))).once()
        // The queue is empty. Dequeues should fail
        await expect(server.Dequeue(instance(user2))).to.eventually.be.rejectedWith('There is no one')
        // The first user should be able to join the queue now
        await expect(server.EnqueueUser('office hours', instance(user1))).to.not.eventually.be.rejectedWith()
        // But they shouldn't be able to join again
        await expect(server.EnqueueUser('office hours', instance(user1))).to.eventually.be.rejectedWith()
        // The second user should be able to dequeue the first user
        await expect(server.Dequeue(instance(user2))).to.eventually.satisfy((state: MemberState) => state.member == instance(user1))
        // The queue should now be empty
        await expect(server.Dequeue(instance(user2))).to.eventually.be.rejectedWith('There is no one')
        // The first user should be able to join the queue again
        await expect(server.EnqueueUser('office hours', instance(user1))).to.not.eventually.be.rejectedWith()
        // And leave on their own free will
        await expect(server.RemoveMemberFromQueues(instance(user1))).to.not.eventually.be.rejectedWith()
        verify(spied_queue.Remove(instance(user1))).once()
        // And the queue should be empty
        await expect(server.Dequeue(instance(user2))).to.eventually.be.rejectedWith('There is no one')
        // The staff shouldn't be able to enter the queue while they're hosting
        await expect(server.EnqueueUser('office hours', instance(user2))).to.eventually.be.rejectedWith('while hosting')

        // Have the first user join the queue
        await expect(server.EnqueueUser('office hours', instance(user1))).to.not.eventually.be.rejectedWith()
        // Remove the staff's queue role
        user2_roles.delete('2')
        // They should not be able to dequeue
        await expect(server.Dequeue(instance(user2))).to.eventually.be.rejectedWith('not registered')
        // Give them back the role
        user2_roles.set('2', instance(mock_oh_role))
        // Close the queue
        await expect(server.RemoveHelper(instance(user2))).to.not.eventually.be.rejectedWith()
        verify(spied_queue.RemoveHelper(instance(user2))).once()
    })

    it('should not allow duplicate queues, but allow a queue to be deleted and recreated', async () => {
        const starting_channels = new Collection<string, AnyChannel>()

        const mock_category_channel = mock<CategoryChannel>()
        instance(mock_category_channel).name = 'office hours'
        instance(mock_category_channel).type = 'GUILD_CATEGORY'
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_category_channel)['children'] = new Collection()
        starting_channels.set('1', instance(mock_category_channel))

        const mock_queue_channel = mock<TextChannel>()
        instance(mock_queue_channel).name = 'queue'
        instance(mock_queue_channel).type = 'GUILD_TEXT'
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_queue_channel)['parent'] = instance(mock_category_channel)
        const mock_message_manager = mock<MessageManager>()
        instance(mock_queue_channel).messages = instance(mock_message_manager)
        when(mock_message_manager.fetchPinned()).thenResolve(new Collection())
        when(mock_queue_channel.send(anyString())).thenResolve(resolvableInstance(mock()))
        starting_channels.set('2', instance(mock_queue_channel))
        instance(mock_category_channel).children.set('1', instance(mock_queue_channel))


        when(mock_roles_manager.create(anything())).thenResolve(resolvableInstance(mock()))

        const starting_roles = new Collection<string, Role>()
        const mock_oh_role = mock<Role>()
        instance(mock_oh_role).name = 'office hours'
        starting_roles.set('1', instance(mock_oh_role))
        // @ts-ignore Overwrite readonly value for testing
        instance(mock_roles_manager)['cache'] = starting_roles

        when(mock_channel_manager.fetch()).thenResolve(starting_channels)
        when(mock_roles_manager.fetch()).thenResolve(starting_roles)

        const mock_channel = mock<VoiceChannel>()
        instance(mock_channel).permissionOverwrites = instance(mock())
        when(mock_channel_manager.create(anything(), anything())).thenResolve(resolvableInstance(mock_channel))

        const server = await AttendingServer.Create(instance(mock_client), guild_instance)
        await expect(server.CreateQueue('office hours')).to.eventually.be.rejectedWith()
        await expect(server.RemoveQueue(instance(mock_category_channel))).to.not.eventually.be.rejectedWith()
        verify(mock_category_channel.delete()).once()
        verify(mock_queue_channel.delete()).once()
        await expect(server.CreateQueue('office hours')).to.not.eventually.be.rejectedWith()
        verify(mock_channel_manager.create('office hours', deepEqual({type: 'GUILD_CATEGORY'}))).once()
        verify(mock_channel_manager.create('queue', deepEqual({type: 'GUILD_TEXT', parent: notUndefined()}))).once()
        verify(mock_channel_manager.create('chat', deepEqual({type: 'GUILD_TEXT', parent: notUndefined()}))).once()
    })

    it('should create queues', async () => {
        const starting_channels = new Collection<string, AnyChannel>()
        const starting_roles = new Collection<string, Role>()

        when(mock_channel_manager.fetch()).thenResolve(starting_channels)
        when(mock_roles_manager.fetch()).thenResolve(starting_roles)
        when(mock_roles_manager.create(anything())).thenResolve(resolvableInstance(mock()))

        const mock_channel = mock<VoiceChannel>()
        instance(mock_channel).permissionOverwrites = instance(mock())
        when(mock_channel_manager.create(anything(), anything())).thenResolve(resolvableInstance(mock_channel))

        const server = await AttendingServer.Create(instance(mock_client), guild_instance)
        await expect(server.CreateQueue('office hours')).to.not.eventually.be.rejectedWith()
        verify(mock_channel_manager.create('office hours', deepEqual({type: 'GUILD_CATEGORY'}))).once()
        verify(mock_channel_manager.create('queue', deepEqual({type: 'GUILD_TEXT', parent: notUndefined()}))).once()
        verify(mock_channel_manager.create('chat', deepEqual({type: 'GUILD_TEXT', parent: notUndefined()}))).once()
        await expect(server.CreateQueue('admin')).to.be.eventually.rejectedWith('cannot be named')
        await expect(server.CreateQueue('staff')).to.be.eventually.rejectedWith('cannot be named')
    })

    it('should remove queues', async () => {
        const starting_channels = new Collection<string, AnyChannel>()

        const mock_category_channel = mock<CategoryChannel>()
        const mock_text_channel = mock<TextChannel>()
        instance(mock_category_channel).name = 'foo'
        instance(mock_category_channel).type = 'GUILD_CATEGORY'
        instance(mock_text_channel).name = 'queue'
        instance(mock_text_channel).type = 'GUILD_TEXT'
        const mock_message_manager = mock<MessageManager>()
        instance(mock_text_channel).messages = instance(mock_message_manager)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Overwrite read-only value for testing
        instance(mock_category_channel)['children'] = new Collection()
        instance(mock_category_channel).children.set('id', instance(mock_text_channel))
        starting_channels.set('1', instance(mock_category_channel))
        starting_channels.set('2', instance(mock_text_channel))

        const starting_roles = new Collection<string, Role>()

        const mock_admin_role = mock<Role>()
        instance(mock_admin_role).name = 'Admin'
        starting_roles.set('1', instance(mock_admin_role))

        const mock_unrelated_role = mock<Role>()
        instance(mock_unrelated_role).name = 'Foo Bar'
        starting_roles.set('2', instance(mock_admin_role))

        const mock_queue_role = mock<Role>()
        instance(mock_queue_role).name = 'foo'
        starting_roles.set('3', instance(mock_queue_role))

        // @ts-ignore Overwrite readonly value for testing
        instance(mock_roles_manager)['cache'] = starting_roles

        when(mock_text_channel.send(anyString())).thenResolve(resolvableInstance(mock()))
        when(mock_channel_manager.fetch()).thenResolve(starting_channels)
        when(mock_roles_manager.fetch()).thenResolve(starting_roles)
        when(mock_roles_manager.create(anything())).thenResolve(resolvableInstance(mock()))
        when(mock_message_manager.fetchPinned()).thenResolve(new Collection())

        const server = await AttendingServer.Create(instance(mock_client), guild_instance)

        await expect(server.RemoveQueue(instance(mock_category_channel))).to.not.eventually.be.rejectedWith()
        verify(mock_category_channel.delete()).once()
        verify(mock_text_channel.delete()).once()
        verify(mock_queue_role.delete()).once()

        const mock_unrelated_channel = mock<CategoryChannel>()
        instance(mock_unrelated_channel).name = 'bar'
        await expect(server.RemoveQueue(instance(mock_unrelated_channel))).to.eventually.be.rejectedWith('There is not a queue')
    })

    it('should discover queues and update roles when created', async () => {
        const starting_channels = new Collection<string, AnyChannel>()

        const mock_category_channel = mock<CategoryChannel>()
        const mock_text_channel = mock<TextChannel>()
        instance(mock_category_channel).name = 'foo'
        instance(mock_category_channel).type = 'GUILD_CATEGORY'
        instance(mock_text_channel).name = 'queue'
        instance(mock_text_channel).type = 'GUILD_TEXT'
        const mock_message_manager = mock<MessageManager>()
        instance(mock_text_channel).messages = instance(mock_message_manager)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Overwrite read-only value for testing
        instance(mock_category_channel)['children'] = new Collection()
        instance(mock_category_channel).children.set('id', instance(mock_text_channel))
        starting_channels.set('1', instance(mock_category_channel))
        starting_channels.set('2', instance(mock_text_channel))

        const starting_roles = new Collection<string, Role>()

        const mock_admin_role = mock<Role>()
        instance(mock_admin_role).name = 'Admin'
        starting_roles.set('1', instance(mock_admin_role))

        const mock_unrelated_role = mock<Role>()
        instance(mock_unrelated_role).name = 'Foo Bar'
        starting_roles.set('2', instance(mock_admin_role))

        when(mock_text_channel.send(anyString())).thenResolve(resolvableInstance(mock()))
        when(mock_channel_manager.fetch()).thenResolve(starting_channels)
        when(mock_roles_manager.fetch()).thenResolve(starting_roles)
        when(mock_roles_manager.create(anything())).thenResolve(resolvableInstance(mock()))
        when(mock_message_manager.fetchPinned()).thenResolve(new Collection())

        let server: AttendingServer
        await expect(AttendingServer.Create(instance(mock_client), guild_instance).then(created => {
            server = created
        })).to.not.eventually.be.rejectedWith()

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore TS wrongly asserts that `server` is not defined
        const queues = server['queues']
        expect(queues.length).to.equal(1)
        expect(queues[0].name).to.equal('foo')
        
        verify(mock_message_manager.fetchPinned()).once()
        // Three roles should be created, 'Student', 'Staff', and 'Foo' (for the Foo queue)
        // The admin role should not be created because it already existed in the server
        verify(mock_roles_manager.create(anything())).times(3)
    })

    it('can ensure users have roles', async () => {
        const starting_roles = new Collection<string, Role>()

        const mock_student_role = mock<Role>()
        instance(mock_student_role).name = 'Student'
        starting_roles.set('1', resolvableInstance(mock_student_role))

        when(mock_channel_manager.fetch()).thenResolve(new Collection())
        when(mock_roles_manager.fetch()).thenResolve(starting_roles)
        when(mock_roles_manager.create(anything())).thenResolve(resolvableInstance(mock()))
        
        const server = await AttendingServer.Create(instance(mock_client), guild_instance)

        const user1 = mock<GuildMember>()
        const user1_roles = new Collection<string, Role>()
        const mock_user1_role_manager = mock<GuildMemberRoleManager>()
        // @ts-ignore Overwite readonly value for testing
        instance(mock_user1_role_manager)['cache'] = user1_roles
        // @ts-ignore Overwite readonly value for testing
        instance(user1)['roles'] = instance(mock_user1_role_manager)
        // @ts-ignore Overwrite readonly value for testing
        guild_instance.roles['everyone'] = instance(mock())
        when(mock_user1_role_manager.highest).thenReturn(guild_instance.roles.everyone)

        await server.EnsureHasRole(instance(user1))
        // Cannot check that the student role was added specifically because resolvableInstances cannot be compared
        verify(mock_user1_role_manager.add(anything())).once()
        
    })
})
