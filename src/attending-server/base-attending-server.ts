/** @module AttendingServerV2 */
import {
    CategoryChannel,
    Collection,
    Guild,
    GuildMember,
    BaseMessageOptions,
    TextChannel,
    User,
    VoiceState,
    ChannelType,
    VoiceBasedChannel,
    Role
} from 'discord.js';
import { AutoClearTimeout, HelpQueueV2 } from '../help-queue/help-queue.js';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper.js';
import { hierarchyRoleConfigs, HierarchyRoles } from '../models/hierarchy-roles.js';
import { Helpee, Helper } from '../models/member-states.js';
import { IServerExtension } from '../extensions/extension-interface.js';
import { GoogleSheetLoggingExtension } from '../extensions/google-sheet-logging/google-sheet-logging.js';
import { FirebaseServerBackupExtension } from './firebase-backup.js';
import { CalendarExtensionState } from '../extensions/session-calendar/calendar-states.js';
import { QueueBackup, ServerBackup } from '../models/backups.js';
import { blue, cyan, green, red } from '../utils/command-line-colors.js';
import {
    convertMsToTime,
    isCategoryChannel,
    isQueueTextChannel,
    isTextChannel,
    isVoiceChannel
} from '../utils/util-functions.js';
import {
    CategoryChannelId,
    GuildMemberId,
    Optional,
    SpecialRoleValues,
    WithRequired
} from '../utils/type-aliases.js';
import { environment } from '../environment/environment-manager.js';
import { ExpectedServerErrors } from './expected-server-errors.js';
import { serverRolesConfigMenu } from './server-settings-menus.js';
import { initializationCheck, updateCommandHelpChannels } from './guild-actions.js';
import { client } from '../global-states.js';

/**
 * Wrapper for TextChannel
 * - Guarantees that a queueName and parentCategoryId exists
 */
type QueueChannel = {
    channelObj: TextChannel;
    queueName: string;
    parentCategoryId: CategoryChannelId;
};

/**
 * V2 of AttendingServer. Represents 1 server that this YABOB is a member of
 * ----
 * - Public functions can be accessed by the command handler
 * - Variables with an underscore has a public getter, but only mutable inside the class
 */
class AttendingServerV2 {
    /** message sent to students after they leave */
    private _afterSessionMessage = '';
    /** optional, channel where yabob will log message. if undefined, don't log on the server */
    private _loggingChannel?: TextChannel;
    /** Key is CategoryChannel.id of the parent catgory of #queue */
    private _queues: Collection<CategoryChannelId, HelpQueueV2> = new Collection();
    /** cached result of {@link getQueueChannels} */
    private queueChannelsCache: QueueChannel[] = [];
    /** unique active helpers, key is member.id */
    private _activeHelpers: Collection<GuildMemberId, Helper> = new Collection();
    /** automatically give new members the student role */
    private _autoGiveStudentRole = false;

    // Role IDs are always snowflake strings (i.e. they are strings that only consist of numbers)
    // - https://discord.com/developers/docs/reference#snowflakes
    // Special values for role IDs:
    // - 'Not Set' means that the role is not set
    // - 'Deleted' means that the role was deleted

    private _hierarchyRoleIds: HierarchyRoles = {
        /** role id of the bot admin role */
        botAdmin: SpecialRoleValues.NotSet,
        /** role id of the helper role */
        staff: SpecialRoleValues.NotSet,
        /** role id of the student role */
        student: SpecialRoleValues.NotSet
    };

    protected constructor(
        readonly user: User,
        readonly guild: Guild,
        private readonly serverExtensions: IServerExtension[]
    ) {}

    get queues(): ReadonlyArray<HelpQueueV2> {
        return [...this._queues.values()];
    }
    get studentsInAllQueues(): ReadonlyArray<Helpee> {
        return this._queues.map(queue => queue.students).flat();
    }
    get activeHelpers(): ReadonlyMap<string, Helper> {
        return this._activeHelpers;
    }
    get queueAutoClearTimeout(): Optional<AutoClearTimeout> {
        return this._queues.first()?.timeUntilAutoClear;
    }
    get afterSessionMessage(): string {
        return this._afterSessionMessage;
    }
    get loggingChannel(): Optional<TextChannel> {
        return this._loggingChannel;
    }
    get botAdminRoleID(): string {
        return this._hierarchyRoleIds.botAdmin;
    }
    get helperRoleID(): string {
        return this._hierarchyRoleIds.staff;
    }
    get studentRoleID(): string {
        return this._hierarchyRoleIds.student;
    }
    /**
     * Returns an array of the roles for this server in decreasing order of hierarchy
     * - The first element is the highest hierarchy role
     * - The last element is the lowest hierarchy role
     * - [Student, Helper, Bot Admin]
     * @returns: { name: string, id: string }[]
     */
    get sortedHierarchyRoles(): Array<{
        name: keyof HierarchyRoles;
        roleName: string;
        id: string;
    }> {
        return Object.entries(this._hierarchyRoleIds).map(([name, id]) => ({
            name: name as keyof HierarchyRoles, // guaranteed to be the key
            roleName: hierarchyRoleConfigs[name as keyof HierarchyRoles].name,
            id: id
        }));
    }
    get hierarchyRoleIds(): HierarchyRoles {
        return this._hierarchyRoleIds;
    }
    get autoGiveStudentRole(): boolean {
        return this._autoGiveStudentRole;
    }

    /** Cleans up all the timers from setInterval */
    clearAllServerTimers(): void {
        this._queues.forEach(queue => queue.clearAllQueueTimers());
    }

    /**
     * Sends the log message to the logging channel if it's set up
     * @param message message to log
     */
    sendLogMessage(message: BaseMessageOptions | string): void {
        if (this._loggingChannel) {
            this._loggingChannel.send(message).catch(e => {
                console.error(red(`Failed to send logs to ${this.guild.name}.`));
                console.error(e);
            });
        }
    }

    private loadBackUp(backup: ServerBackup): void {
        console.log(cyan(`Found external backup for ${this.guild.name}. Restoring.`));
        const loggingChannelFromBackup = this.guild.channels.cache.get(
            backup.loggingChannelId
        );
        if (isTextChannel(loggingChannelFromBackup)) {
            this._loggingChannel = loggingChannelFromBackup;
        }
        this._afterSessionMessage = backup.afterSessionMessage;
        this._hierarchyRoleIds = {
            botAdmin: backup.botAdminRoleId,
            staff: backup.helperRoleId,
            student: backup.studentRoleId
        };
        //check if roles still exist
        this.sortedHierarchyRoles.forEach(role => {
            if (this.guild.roles.cache.get(role.id) === undefined) {
                this._hierarchyRoleIds[role.name] = SpecialRoleValues.Deleted;
            }
        });
        this._autoGiveStudentRole = backup.autoGiveStudentRole;
    }

    /**
     * Sets the internal boolean value for autoGiveStudentRole
     * @param autoGiveStudentRole
     */
    async setAutoGiveStudentRole(autoGiveStudentRole: boolean): Promise<void> {
        this._autoGiveStudentRole = autoGiveStudentRole;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sets the Bot Admin Role ID to `roleID` for this server
     * @param roleID
     */
    async setBotAdminRoleID(roleID: string): Promise<void> {
        this._hierarchyRoleIds.botAdmin = roleID;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }
    /**
     * Sets the Helper Role ID to `roleID` for this server
     * @param roleID
     */
    async setHelperRoleID(roleID: string): Promise<void> {
        this._hierarchyRoleIds.staff = roleID;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }
    /**
     * Sets the Student Role ID to `roleID` for this server
     * @param roleID
     */
    async setStudentRoleID(roleID: string): Promise<void> {
        this._hierarchyRoleIds.student = roleID;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sets the serious server flag, and updates the queues if changing from serious to not serious, or vice versa
     * @param enableSeriousMode new value for seriousServer
     * @returns True if triggered renders for all queues
     */
    async setSeriousServer(enableSeriousMode: boolean): Promise<boolean> {
        const alreadySerious = this.queues[0]?.seriousModeEnabled ?? false;
        if (alreadySerious === enableSeriousMode) {
            return false;
        }
        await Promise.all([
            this._queues.map(queue => queue.setSeriousMode(enableSeriousMode)),
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        ]);
        return true;
    }

    /**
     * Asynchronously creates a YABOB instance for 1 server
     * @param guild the server for YABOB to join
     * @returns a created instance of YABOB
     * @throws ServerError
     */
    static async create(guild: Guild): Promise<AttendingServerV2> {
        await initializationCheck(guild);
        // Load ServerExtensions here
        const serverExtensions: IServerExtension[] = environment.disableExtensions
            ? []
            : await Promise.all([
                  GoogleSheetLoggingExtension.load(guild),
                  new FirebaseServerBackupExtension(guild),
                  CalendarExtensionState.load(guild)
              ]);
        const server = new AttendingServerV2(client.user, guild, serverExtensions);
        const externalBackup = environment.disableExtensions
            ? undefined
            : await Promise.all(
                  serverExtensions.map(extension =>
                      extension.loadExternalServerData(guild.id)
                  )
              );
        const validBackup = externalBackup?.find(backup => backup !== undefined);
        if (validBackup !== undefined) {
            server.loadBackUp(validBackup);
        }
        const missingRoles = server.sortedHierarchyRoles.filter(
            role =>
                role.id === SpecialRoleValues.NotSet ||
                role.id === SpecialRoleValues.Deleted
        );
        if (missingRoles.length > 0) {
            const owner = await guild.fetchOwner();
            await owner.send(serverRolesConfigMenu(server, owner.id, true, true));
        }
        await Promise.all([
            server.initAllQueues(validBackup?.queues, validBackup?.hoursUntilAutoClear),
            server.createQueueRoles(),
            updateCommandHelpChannels(guild)
        ]).catch(err => {
            console.error(err);
            throw new Error(`❗ ${red(`Initilization for ${guild.name} failed.`)}`);
        });
        await Promise.all(
            serverExtensions.map(extension => extension.onServerInitSuccess(server))
        );
        console.log(`⭐ ${green(`Initilization for ${guild.name} is successful!`)}`);
        return server;
    }

    /**
     * Called when a member joins a voice channel
     * - triggers onStudentJoinVC for all extensions if the member is a
     * student and was just removed from the queue
     * @param member
     * @param newVoiceState
     */
    async onMemberJoinVC(
        member: GuildMember,
        newVoiceState: WithRequired<VoiceState, 'channel'>
    ): Promise<void> {
        // temporary solution, stage channel is not currently supported
        if (!isVoiceChannel(newVoiceState.channel)) {
            return;
        }
        const vc = newVoiceState.channel;
        const memberIsStudent = this._activeHelpers.some(helper =>
            helper.helpedMembers.some(
                helpedMember => helpedMember.member.id === member.id
            )
        );
        const memberIsHelper = this._activeHelpers.has(member.id);
        if (memberIsStudent) {
            const possibleHelpers = newVoiceState.channel.members.filter(
                vcMember => vcMember.id !== member.id
            );
            const queuesToRerender = this._queues.filter(queue =>
                possibleHelpers.some(possibleHelper =>
                    queue.activeHelperIds.has(possibleHelper.id)
                )
            );
            await Promise.all([
                ...this.serverExtensions.map(extension =>
                    extension.onStudentJoinVC(this, member, vc)
                ),
                ...queuesToRerender.map(queue => queue.triggerRender())
            ]);
        }
        if (memberIsHelper) {
            await Promise.all(
                this.queues.map(
                    queue => queue.activeHelperIds.has(member.id) && queue.triggerRender()
                )
            );
        }
    }

    /**
     * Called when a member leaves a voice channel
     * - triggers onStudentLeaveVC for all extensions if the member is a
     * student and was in a session
     * @param member
     * @param oldVoiceState
     */
    async onMemberLeaveVC(
        member: GuildMember,
        oldVoiceState: WithRequired<VoiceState, 'channel'>
    ): Promise<void> {
        const memberIsStudent = this._activeHelpers.some(helper =>
            helper.helpedMembers.some(
                helpedMember => helpedMember.member.id === member.id
            )
        );
        const memberIsHelper = this._activeHelpers.has(member.id);
        if (memberIsStudent) {
            const possibleHelpers = oldVoiceState.channel.members.filter(
                vcMember => vcMember.id !== member.id
            );
            const queuesToRerender = this.queues.filter(queue =>
                possibleHelpers.some(possibleHelper =>
                    queue.activeHelperIds.has(possibleHelper.id)
                )
            );
            await Promise.all([
                ...oldVoiceState.channel.permissionOverwrites.cache.map(
                    overwrite => overwrite.id === member.id && overwrite.delete()
                ),
                ...this.serverExtensions.map(extension =>
                    extension.onStudentLeaveVC(this, member)
                ),
                this.afterSessionMessage !== '' &&
                    member.send(SimpleEmbed(this.afterSessionMessage)),
                ...queuesToRerender.map(queue => queue.triggerRender())
            ]);
        }
        if (memberIsHelper) {
            // the filter is removed because
            // the overwrite will die in 15 minutes after the invite was sent
            await Promise.all(
                this.queues.map(
                    queue => queue.activeHelperIds.has(member.id) && queue.triggerRender()
                )
            );
        }
    }

    /**
     * Gets all the queue channels on the server. SLOW
     * if nothing is found, returns empty array
     * @param useCache whether to read from existing cache, defaults to true
     * - unless queues change often, prefer cache for fast response
     */
    async getQueueChannels(useCache = true): Promise<QueueChannel[]> {
        if (useCache && this.queueChannelsCache.length !== 0) {
            return this.queueChannelsCache;
        }
        const allChannels = await this.guild.channels.fetch();
        // cache again on a fresh request, likely triggers GC
        this.queueChannelsCache = [];
        for (const categoryChannel of allChannels.values()) {
            if (!isCategoryChannel(categoryChannel)) {
                continue;
            }
            const queueTextChannel: Optional<TextChannel> =
                categoryChannel.children.cache.find(isQueueTextChannel);
            if (!queueTextChannel) {
                continue;
            }
            this.queueChannelsCache.push({
                channelObj: queueTextChannel,
                queueName: categoryChannel.name,
                parentCategoryId: categoryChannel.id
            });
        }
        const duplicateQueues = this.queueChannelsCache
            .map(queue => queue.queueName)
            .filter((item, index, arr) => arr.indexOf(item) !== index);
        if (duplicateQueues.length > 0) {
            console.warn(`Server['${this.guild.name}'] contains these duplicate queues:`);
            console.warn(duplicateQueues);
            console.warn(
                `This might lead to unexpected behaviors.\n
                Please update category names as soon as possible.`
            );
        }
        return this.queueChannelsCache;
    }

    /**
     * Creates a new OH queue
     * @param newQueueName name for this class/queue
     * @throws ServerError: if a queue with the same name already exists
     */
    async createQueue(newQueueName: string): Promise<void> {
        const queueWithSameName = this._queues.find(
            queue => queue.queueName === newQueueName
        );
        if (queueWithSameName !== undefined) {
            throw ExpectedServerErrors.queueAlreadyExists(newQueueName);
        }
        const parentCategory = await this.guild.channels.create({
            name: newQueueName,
            type: ChannelType.GuildCategory
        });
        const [queueTextChannel] = await Promise.all([
            parentCategory.children.create({ name: 'queue' }),
            parentCategory.children.create({ name: 'chat' })
        ]);
        const queueChannel: QueueChannel = {
            channelObj: queueTextChannel,
            queueName: newQueueName,
            parentCategoryId: parentCategory.id
        };
        const [helpQueue] = await Promise.all([
            HelpQueueV2.create(queueChannel, this.guild.roles.everyone),
            this.createQueueRoles()
        ]);
        this._queues.set(parentCategory.id, helpQueue);
        await this.getQueueChannels(false);
    }

    /**
     * Deletes a queue by categoryID
     * @param queueCategoryID CategoryChannel.id of the target queue
     * @throws ServerError: If a discord API failure happened
     * - #queue existence is checked by CentralCommandHandler
     */
    async deleteQueueById(queueCategoryID: string): Promise<void> {
        const queue = this._queues.get(queueCategoryID);
        if (queue === undefined) {
            throw ExpectedServerErrors.queueDoesNotExist;
        }
        // delete queue data model no matter if the category was deleted by the user
        // now only the queue variable holds the queue channel
        this._queues.delete(queueCategoryID);
        const allChannels = await this.guild.channels.fetch();
        const parentCategory = allChannels.find(
            (channel): channel is CategoryChannel =>
                isCategoryChannel(channel) && channel.id === queueCategoryID
        );
        if (!parentCategory) {
            // this shouldn't happen bc input type restriction on the command
            // but we need to pass ts check
            throw ExpectedServerErrors.queueDoesNotExist;
        }
        // delete child channels first
        await Promise.all(parentCategory.children.cache.map(child => child.delete()));
        // now delete category, role, and let queue call onQueueDelete
        await Promise.all([
            parentCategory.delete(),
            this.guild.roles.cache
                .find(role => role.name === parentCategory.name)
                ?.delete(),
            queue.gracefulDelete()
        ]);
        await this.getQueueChannels(false);
    }

    /**
     * Attempt to enqueue a student
     * @param studentMember student member to enqueue
     * @param queueChannel target queue
     * @throws QueueError: if queue rejects
     */
    async enqueueStudent(
        studentMember: GuildMember,
        queueChannel: QueueChannel
    ): Promise<void> {
        await this._queues.get(queueChannel.parentCategoryId)?.enqueue(studentMember);
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Dequeue the student that has been waiting for the longest
     * @param helperMember the helper that used /next
     * - ignored if specified queue is undefined
     * @throws
     * - ServerError: if specificQueue is given but helper doesn't have the role
     * - QueueError: if the queue to dequeue from rejects
     */
    async dequeueGlobalFirst(helperMember: GuildMember): Promise<Readonly<Helpee>> {
        const [currentlyHelpingQueues, helperObject] = [
            this._queues.filter(queue => queue.activeHelperIds.has(helperMember.id)),
            this._activeHelpers.get(helperMember.id)
        ];
        if (currentlyHelpingQueues.size === 0 || !helperObject) {
            throw ExpectedServerErrors.notHosting;
        }
        const helperVoiceChannel = helperMember.voice.channel;
        if (helperVoiceChannel === null) {
            throw ExpectedServerErrors.notInVC;
        }
        const nonEmptyQueues = currentlyHelpingQueues.filter(
            queue => queue.isOpen && queue.length !== 0
        );
        // check must happen before reduce, reduce on empty arrays will throw an error
        if (nonEmptyQueues.size === 0) {
            throw ExpectedServerErrors.noOneToHelp;
        }
        const queueToDequeue = nonEmptyQueues.reduce<HelpQueueV2>(
            (prev, curr) =>
                prev.first &&
                curr.first &&
                prev.first.waitStart.getTime() < curr.first.waitStart.getTime()
                    ? prev // if the first 2 conditions passed,
                    : curr // both prev.first and curr.first will not be undefined
        );
        const student = await queueToDequeue.dequeueWithHelper(helperMember);
        helperObject.helpedMembers.push(student);
        await Promise.all([
            this.sendInvite(student.member, helperVoiceChannel),
            ...this.serverExtensions.map(extension =>
                extension.onDequeueFirst(this, student)
            ),
            ...this.serverExtensions.map(extension =>
                extension.onServerRequestBackup(this)
            )
        ]);
        return student;
    }

    /**
     * Handle /next with arguments
     * @param specificQueue if specified, dequeue from this queue
     * @param targetStudentMember if specified, remove this student and override queue order
     */
    async dequeueWithArgs(
        helperMember: GuildMember,
        targetStudentMember?: GuildMember,
        specificQueue?: QueueChannel
    ): Promise<Readonly<Helpee>> {
        const [currentlyHelpingQueues, helperObject] = [
            this._queues.filter(queue => queue.activeHelperIds.has(helperMember.id)),
            this._activeHelpers.get(helperMember.id)
        ];
        if (currentlyHelpingQueues.size === 0 || !helperObject) {
            console.log(currentlyHelpingQueues.size, helperObject);
            throw ExpectedServerErrors.notHosting;
        }
        const helperVoiceChannel = helperMember.voice.channel;
        if (helperVoiceChannel === null) {
            throw ExpectedServerErrors.notInVC;
        }
        let student: Readonly<Helpee>;
        if (specificQueue !== undefined) {
            // if queue is specified, find the queue and let queue dequeue
            const queueToDequeue = this._queues.get(specificQueue.parentCategoryId);
            if (queueToDequeue === undefined) {
                throw ExpectedServerErrors.queueDoesNotExist;
            }
            student = await queueToDequeue.dequeueWithHelper(
                helperMember,
                targetStudentMember
            );
        } else if (targetStudentMember !== undefined) {
            const queueToDequeue = this._queues.find(queue =>
                queue.students.some(
                    student => student.member.id === targetStudentMember.id
                )
            );
            if (queueToDequeue === undefined) {
                throw ExpectedServerErrors.studentNotFound(
                    targetStudentMember.displayName
                );
            }
            student = await queueToDequeue.removeStudent(targetStudentMember);
        } else {
            throw ExpectedServerErrors.badDequeueArguments;
        }
        helperObject.helpedMembers.push(student);
        await Promise.all([
            this.sendInvite(student.member, helperVoiceChannel),
            ...this.serverExtensions.map(extension =>
                extension.onDequeueFirst(this, student)
            ),
            ...this.serverExtensions.map(extension =>
                extension.onServerRequestBackup(this)
            )
        ]);
        return student;
    }

    /**
     * Opens all the queue that the helper has permission to
     * @param helperMember helper that used /start
     * @throws ServerError
     * - If the helper doesn't have any class roles
     * - If the helper is already hosting
     */
    async openAllOpenableQueues(
        helperMember: GuildMember,
        notify: boolean
    ): Promise<void> {
        if (this._activeHelpers.has(helperMember.id)) {
            throw ExpectedServerErrors.alreadyHosting;
        }
        const helper: Helper = {
            helpStart: new Date(),
            helpedMembers: [],
            member: helperMember
        };
        this._activeHelpers.set(helperMember.id, helper);
        const openableQueues = this._queues.filter(queue =>
            helperMember.roles.cache.map(role => role.name).includes(queue.queueName)
        );
        if (openableQueues.size === 0) {
            ExpectedServerErrors.noClassRole;
        }
        await Promise.all(
            openableQueues.map(queue => queue.openQueue(helperMember, notify))
        );
        await Promise.all(
            this.serverExtensions.map(extension =>
                extension.onHelperStartHelping(this, helper)
            )
        );
    }

    /**
     * Closes all the queue that the helper has permission to & logs the help time to console
     * @param helperMember helper that used /stop
     * @throws ServerError: If the helper is not hosting
     */
    async closeAllClosableQueues(helperMember: GuildMember): Promise<Required<Helper>> {
        const helper = this._activeHelpers.get(helperMember.id);
        if (helper === undefined) {
            throw ExpectedServerErrors.notHosting;
        }
        this._activeHelpers.delete(helperMember.id);
        const completeHelper: Required<Helper> = {
            ...helper,
            helpEnd: new Date()
        };
        console.log(
            ` - Help time of ${helper.member.displayName} is ` +
                `${convertMsToTime(
                    completeHelper.helpEnd.getTime() - completeHelper.helpStart.getTime()
                )}`
        );
        const closableQueues = this._queues.filter(
            queue =>
                helperMember.roles.cache
                    .map(role => role.name)
                    .includes(queue.queueName) && queue.isOpen
        ); // 2nd condition handles adding queue roles during a tutoring session
        await Promise.all(closableQueues.map(queue => queue.closeQueue(helperMember)));
        await Promise.all(
            this.serverExtensions.map(extension =>
                extension.onHelperStopHelping(this, completeHelper)
            )
        );
        return completeHelper;
    }

    /**
     * Removes a student from a given queue
     * @param studentMember student that used /leave or the cleave button
     * @param targetQueue the queue to leave from
     * @throws QueueError: if @param targetQueue rejects
     */
    async removeStudentFromQueue(
        studentMember: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        await this._queues
            .get(targetQueue.parentCategoryId)
            ?.removeStudent(studentMember);
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Clears the given queue
     * @param targetQueue queue to clear
     */
    async clearQueue(targetQueue: QueueChannel): Promise<void> {
        await this._queues.get(targetQueue.parentCategoryId)?.removeAllStudents();
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Clear all queues of this server
     * @remark separated from clear queue to avoid excessive backup calls
     */
    async clearAllQueues(): Promise<void> {
        await Promise.all(this._queues.map(queue => queue.removeAllStudents()));
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Adds a student to the notification group
     * @param studentMember student to add
     * @param targetQueue which notif group to add to
     */
    async addStudentToNotifGroup(
        studentMember: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        await this._queues
            .get(targetQueue.parentCategoryId)
            ?.addToNotifGroup(studentMember);
    }

    /**
     * Removes a student from the notification group
     * @param studentMember student to add
     * @param targetQueue which notif group to remove from
     */
    async removeStudentFromNotifGroup(
        studentMember: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        await this._queues
            .get(targetQueue.parentCategoryId)
            ?.removeFromNotifGroup(studentMember);
    }

    /**
     * Send an announcement to all the students in the helper's approved queues
     * @param helperMember helper that used /announce
     * @param announcement announcement body
     * @param targetQueue optional, specifies which queue to announce to
     */
    async announceToStudentsInQueue(
        helperMember: GuildMember,
        announcement: string,
        targetQueue?: QueueChannel
    ): Promise<void> {
        if (targetQueue !== undefined) {
            const queueToAnnounce = this._queues.get(targetQueue.parentCategoryId);
            if (
                queueToAnnounce === undefined ||
                !helperMember.roles.cache.some(
                    role =>
                        role.name === targetQueue.queueName ||
                        role.id === this.botAdminRoleID
                )
            ) {
                throw ExpectedServerErrors.noAnnouncePerm(targetQueue.queueName);
            }
            await Promise.all(
                queueToAnnounce.students.map(student =>
                    student.member.send(
                        SimpleEmbed(
                            `Staff member ${helperMember.displayName} announced:\n${announcement}`,
                            EmbedColor.Aqua,
                            `In queue: ${targetQueue.queueName}`
                        )
                    )
                )
            );
            return;
        }
        // from this.queues select queue where helper roles has queue name
        const studentsToAnnounceTo = this.queues
            .filter(queue =>
                helperMember.roles.cache.some(role => role.name === queue.queueName)
            )
            .flatMap(queueToAnnounce => queueToAnnounce.students);
        if (studentsToAnnounceTo.length === 0) {
            throw ExpectedServerErrors.noStudentToAnnounce(announcement);
        }
        await Promise.all(
            studentsToAnnounceTo.map(student =>
                student.member.send(
                    SimpleEmbed(
                        `Staff member ${helperMember.displayName} announced:`,
                        EmbedColor.Aqua,
                        announcement
                    )
                )
            )
        );
    }

    /**
     * Cleans up the given queue and resend all embeds
     * @param targetQueue the queue to clean
     */
    async cleanUpQueue(targetQueue: QueueChannel): Promise<void> {
        await this._queues.get(targetQueue.parentCategoryId)?.triggerForceRender();
    }

    /**
     * Sets the after sesseion message for this server
     * @param newMessage after session message to set
     * - Side Effect: Triggers a firebase backup
     */
    async setAfterSessionMessage(newMessage: string): Promise<void> {
        this._afterSessionMessage = newMessage;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sets up queue auto clear for this server
     * @param hours the number of hours to wait before clearing the queue
     * @param minutes the number of minutes to wait before clearing the queue
     * @param enable whether to disable auto clear, overrides 'hours'
     */
    async setQueueAutoClear(
        hours: number,
        minutes: number,
        enable: boolean
    ): Promise<void> {
        this._queues.forEach(queue => queue.setAutoClear(hours, minutes, enable));
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Called when leaving a server
     * - let all the extensions clean up their own memory
     */
    async gracefulDelete(): Promise<void> {
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerDelete(this))
        );
    }

    /**
     * Sets the logging channel for this server
     * @param loggingChannel the new logging channel.
     * - If undefined, disables logging for this server
     */
    async setLoggingChannel(loggingChannel?: TextChannel): Promise<void> {
        this._loggingChannel = loggingChannel;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sends the VC invite to the student after successful dequeue
     * @param helperObject
     * @param student
     * @param helperVoiceChannel
     */
    private async sendInvite(
        student: GuildMember,
        helperVoiceChannel: VoiceBasedChannel
    ) {
        const [invite] = await Promise.all([
            helperVoiceChannel.createInvite({
                maxAge: 15 * 60,
                maxUses: 1
            }),
            helperVoiceChannel.permissionOverwrites.create(student, {
                ViewChannel: true,
                Connect: true
            })
        ]);
        await student.send(
            SimpleEmbed(
                `It's your turn! Join the call: ${invite.toString()}`,
                EmbedColor.Success
            )
        );
        // remove the overwrite when the link dies
        setTimeout(() => {
            helperVoiceChannel.permissionOverwrites.cache
                .find(overwrite => overwrite.id === student.id)
                ?.delete()
                .catch(() =>
                    console.error(`Failed to delete overwrite for ${student.displayName}`)
                );
        }, 15 * 60 * 1000);
    }

    /**
     * Creates all the office hour queues
     * @param queueBackups
     * - if a backup extension is enabled, this is the queue data to load
     */
    private async initAllQueues(
        queueBackups?: QueueBackup[],
        hoursUntilAutoClear: AutoClearTimeout = 'AUTO_CLEAR_DISABLED',
        seriousModeEnabled = false
    ): Promise<void> {
        const queueChannels = await this.getQueueChannels(false);
        await Promise.all(
            queueChannels.map(async channel => {
                const backup = queueBackups?.find(
                    backup => backup.parentCategoryId === channel.parentCategoryId
                );
                const completeBackup = backup
                    ? {
                          ...backup,
                          timeUntilAutoClear: hoursUntilAutoClear,
                          seriousModeEnabled: seriousModeEnabled
                      }
                    : undefined;
                this._queues.set(
                    channel.parentCategoryId,
                    await HelpQueueV2.create(
                        channel,
                        this.guild.roles.everyone,
                        completeBackup
                    )
                );
            })
        );
        console.log(
            `All queues in '${this.guild.name}' successfully created` +
                `${environment.disableExtensions ? '' : blue(' with their extensions')}!`
        );
        await Promise.all(
            this.serverExtensions.map(extension =>
                extension.onAllQueuesInit(this, this.queues)
            )
        );
    }

    /**
     * Creates all the command access hierarchy roles
     * @param forceNewRoles if true, creates new roles even if they already exist
     * - Duplicates will be created if roles with the same name already exist
     * @param defaultStudentIsEveryone whether to treat @everyone as the student role
     */
    async createHierarchyRoles(
        forceNewRoles: boolean,
        defaultStudentIsEveryone: boolean
    ): Promise<void> {
        const allRoles = await this.guild.roles.fetch();
        const foundRoles: Array<{ name: string; pos: number }> = [];
        const createdRoles: Array<{ name: string; pos: number }> = [];
        if (!forceNewRoles) {
            for (const role of this.sortedHierarchyRoles) {
                const existingRole =
                    role.id === SpecialRoleValues.NotSet ||
                    role.id === SpecialRoleValues.Deleted
                        ? allRoles.find(
                              existingRole => existingRole.name === role.roleName
                          )
                        : allRoles.get(role.id);
                if (existingRole !== undefined) {
                    this._hierarchyRoleIds[role.name] = existingRole.id;
                    foundRoles.push({
                        name: existingRole.name,
                        pos: existingRole.position
                    });
                }
            }
        } else {
            for (const role of this.sortedHierarchyRoles) {
                const newRole = await this.guild.roles.create({
                    ...hierarchyRoleConfigs[role.name]
                });
                this._hierarchyRoleIds[role.name] = newRole.id;
                createdRoles.push({
                    name: newRole.name,
                    pos: newRole.position
                });
            }
        }
        if (defaultStudentIsEveryone) {
            this._hierarchyRoleIds.student = this.guild.roles.everyone.id;
        }
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
        createdRoles.length > 0
            ? console.log('Created roles:', createdRoles)
            : console.log(`All required roles exist in ${this.guild.name}!`);
        foundRoles.length > 0 && console.log('Found roles:', foundRoles);
    }

    /**
     * Checks the deleted `role` was a hierarchy role and if so, mark as deleted
     * @param deletedRole the role that was deleted
     */
    async onRoleDelete(deletedRole: Role): Promise<void> {
        let hierarchyRoleDeleted = false;
        for (const { name, id } of this.sortedHierarchyRoles) {
            if (deletedRole.id === id) {
                this._hierarchyRoleIds[name] = SpecialRoleValues.Deleted;
                hierarchyRoleDeleted = true;
            }
        }
        if (!hierarchyRoleDeleted) {
            return;
        }
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Creates roles for all the available queues if not already created
     */
    private async createQueueRoles(): Promise<void> {
        const existingRoles = new Set(this.guild.roles.cache.map(role => role.name));
        const queueNames = (await this.getQueueChannels(false)).map(ch => ch.queueName);
        await Promise.all(
            queueNames.map(roleToCreate => {
                !existingRoles.has(roleToCreate) &&
                    this.guild.roles.create({
                        name: roleToCreate,
                        position: 1
                    });
            })
        );
    }
}

export { AttendingServerV2, QueueChannel };
