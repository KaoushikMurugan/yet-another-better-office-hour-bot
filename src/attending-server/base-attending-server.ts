/** @module AttendingServerV2 */
import {
    CategoryChannel,
    Collection,
    Guild,
    GuildMember,
    BaseMessageOptions,
    TextChannel,
    VoiceState,
    ChannelType,
    Role,
    Snowflake
} from 'discord.js';
import { AutoClearTimeout, HelpQueueV2 } from '../help-queue/help-queue.js';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper.js';
import {
    AccessLevelRole,
    accessLevelRoleConfigs,
    AccessLevelRoleIds
} from '../models/access-level-roles.js';
import { Helpee, Helper } from '../models/member-states.js';
import { ServerExtension } from '../extensions/extension-interface.js';
import { GoogleSheetServerExtension } from '../extensions/google-sheet-logging/google-sheet-server-extension.js';
import { FirebaseServerBackupExtension } from './firebase-backup.js';
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
    OptionalRoleId,
    SpecialRoleValues,
    WithRequired
} from '../utils/type-aliases.js';
import { environment } from '../environment/environment-manager.js';
import { ExpectedServerErrors } from './expected-server-errors.js';
import { RolesConfigMenuForServerInit } from './server-settings-menus.js';
import {
    initializationCheck,
    sendInvite,
    updateCommandHelpChannelVisibility,
    updateCommandHelpChannels
} from './guild-actions.js';
import { CalendarServerExtension } from '../extensions/session-calendar/calendar-server-extension.js';
import { UnknownId } from '../utils/component-id-factory.js';

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
 * The possible settings of each server
 */
type ServerSettings = {
    /** Message sent to students after they leave */
    afterSessionMessage: string;
    /** Optional, channel where yabob will log message. if undefined, don't log on the server */
    loggingChannel?: TextChannel;
    /** Automatically give new members the student role */
    autoGiveStudentRole: boolean;
    /** Prompt modal asking for help topic when a user joins a queue */
    promptHelpTopic: boolean;
    /**
     * Role IDs are always snowflake strings (i.e. they are strings that only consist of numbers)
     * @see https://discord.com/developers/docs/reference#snowflakes
     * @remark Special values for role IDs:
     * - 'NotSet' means that the role is not set
     * - 'Deleted' means that the role was deleted
     */
    accessLevelRoleIds: AccessLevelRoleIds;
};

/**
 * Represents 1 server that this YABOB is a member of.
 * - Public functions can be accessed by the command handler
 * - Variables with an underscore has a public getter, but only mutable inside the class
 */
class AttendingServerV2 {
    /**
     * All the servers that YABOB is managing
     * @remark Do NOT call the {@link AttendingServerV2} methods (except getters)
     * without passing through a interaction handler first
     * - equivalent to the old attendingServers global object
     */
    private static readonly allServers: Collection<Snowflake, AttendingServerV2> =
        new Collection();

    /**
     * Unique helpers (both active and paused)
     * - Key is GuildMember.id
     */
    private _helpers: Collection<GuildMemberId, Helper> = new Collection();
    /**
     * All the queues of this server
     * - Key is CategoryChannel.id of the parent category of #queue
     */
    private _queues: Collection<CategoryChannelId, HelpQueueV2> = new Collection();
    /**
     * Cached result of {@link getQueueChannels}
     */
    private queueChannelsCache: QueueChannel[] = [];
    /**
     * Server settings. An firebase update is requested as soon as this changes
     */
    private settings: ServerSettings = {
        // TODO: Use the Proxy class to abstract away the update logic
        afterSessionMessage: '',
        autoGiveStudentRole: false,
        promptHelpTopic: true,
        accessLevelRoleIds: {
            botAdmin: SpecialRoleValues.NotSet,
            staff: SpecialRoleValues.NotSet,
            student: SpecialRoleValues.NotSet
        }
    };

    protected constructor(
        readonly guild: Guild,
        readonly serverExtensions: ReadonlyArray<ServerExtension>
    ) {}

    /**
     * Number of correctly initialized AttendingServers
     */
    static get activeServersCount(): number {
        return AttendingServerV2.allServers.size;
    }

    /** All the access level role ids */
    get accessLevelRoleIds(): AccessLevelRoleIds {
        return this.settings.accessLevelRoleIds;
    }

    /** The after session message string. Empty string if not set */
    get afterSessionMessage(): string {
        return this.settings.afterSessionMessage;
    }

    /** whether to automatically give new members the student role */
    get autoGiveStudentRole(): boolean {
        return this.settings.autoGiveStudentRole;
    }

    /** bot admin role id */
    get botAdminRoleID(): OptionalRoleId {
        return this.settings.accessLevelRoleIds.botAdmin;
    }

    /** All the helpers on this server, both active and paused */
    get helpers(): ReadonlyMap<string, Helper> {
        return this._helpers;
    }

    /**
     * Returns true if the server is in serious mode
     * @returns boolean, defaults to false if no queues exist on this server
     */
    get isSerious(): boolean {
        return this.queues[0]?.isSerious ?? false;
    }

    /** The logging channel on this server. undefined if not set */
    get loggingChannel(): Optional<TextChannel> {
        return this.settings.loggingChannel;
    }

    /** whether to prompt modal asking for help topic when a user joins a queue */
    get promptHelpTopic(): boolean {
        return this.settings.promptHelpTopic;
    }

    /** Auto clear values of a queue, undefined if not set */
    get queueAutoClearTimeout(): Optional<AutoClearTimeout> {
        return this._queues.first()?.timeUntilAutoClear;
    }

    /** List of queues on this server */
    get queues(): ReadonlyArray<HelpQueueV2> {
        return [...this._queues.values()];
    }

    /**
     * Returns an array of the roles for this server in the order [Bot Admin, Helper, Student]
     */
    get sortedAccessLevelRoles(): ReadonlyArray<{
        key: AccessLevelRole; // this can be used to index accessLevelRoleConfigs and AccessLevelRoleIds
        displayName: typeof accessLevelRoleConfigs[keyof AccessLevelRoleIds]['displayName'];
        id: OptionalRoleId;
    }> {
        return Object.entries(this.settings.accessLevelRoleIds).map(([name, id]) => ({
            key: name as AccessLevelRole, // guaranteed to be the key
            displayName:
                accessLevelRoleConfigs[name as keyof AccessLevelRoleIds].displayName,
            id: id
        }));
    }

    /** staff role id */
    get staffRoleID(): OptionalRoleId {
        return this.settings.accessLevelRoleIds.staff;
    }

    /** student role id, this is the everyone role if "@everyone is student" is selected */
    get studentRoleID(): OptionalRoleId {
        return this.settings.accessLevelRoleIds.student;
    }

    /** All the students that are currently in a queue */
    get studentsInAllQueues(): ReadonlyArray<Helpee> {
        return this.queues.flatMap(queue => queue.students);
    }

    /**
     * Asynchronously creates a YABOB instance for 1 server
     * @param guild the server for YABOB to join
     * @returns a created instance of YABOB
     * @throws {Error} if any setup functions fail (uncaught)
     */
    static async create(guild: Guild): Promise<AttendingServerV2> {
        await initializationCheck(guild);
        // Load ServerExtensions here
        const serverExtensions: ServerExtension[] = environment.disableExtensions
            ? [] // TODO: Should we always load the firebase extension?
            : await Promise.all([
                  GoogleSheetServerExtension.load(guild),
                  new FirebaseServerBackupExtension(guild),
                  CalendarServerExtension.load(guild)
              ]);
        const server = new AttendingServerV2(guild, serverExtensions);
        const externalBackup = environment.disableExtensions
            ? undefined
            : await Promise.all(
                  serverExtensions.map(extension =>
                      extension.loadExternalServerData(guild.id)
                  )
              );
        const validBackup = externalBackup?.find(backup => backup !== undefined);
        if (validBackup !== undefined) {
            server.loadBackup(validBackup);
        }
        const missingRoles = server.sortedAccessLevelRoles.filter(
            role =>
                role.id === SpecialRoleValues.NotSet ||
                role.id === SpecialRoleValues.Deleted ||
                !guild.roles.cache.has(role.id)
        );
        if (missingRoles.length > 0) {
            const owner = await guild.fetchOwner();
            await owner.send(
                RolesConfigMenuForServerInit(
                    server,
                    owner.dmChannel?.id ?? UnknownId,
                    false
                )
            );
        }
        await Promise.all([
            server.initializeAllQueues(
                validBackup?.queues,
                validBackup?.hoursUntilAutoClear
            ),
            server.createQueueRoles(),
            updateCommandHelpChannels(guild, server.accessLevelRoleIds)
        ]).catch(err => {
            console.error(err);
            throw new Error(`❗ ${red(`Initialization for ${guild.name} failed.`)}`);
        });
        await Promise.all(
            serverExtensions.map(extension => extension.onServerInitSuccess(server))
        );
        AttendingServerV2.allServers.set(guild.id, server);
        console.log(`⭐ ${green(`Initialization for ${guild.name} is successful!`)}`);
        return server;
    }

    /**
     * Gets a AttendingServerV2 object by Id
     * @param serverId guild Id
     * @returns the corresponding server object
     * @throws {ServerError} if no server with this server id exists
     */
    static get(serverId: Snowflake): AttendingServerV2 {
        const server = AttendingServerV2.allServers.get(serverId);
        if (!server) {
            throw ExpectedServerErrors.notInitialized;
        }
        return server;
    }

    /**
     * Non exception based version of `AttendingServerV2.get`
     * @param serverId guild id
     * @returns ServerError if no such AttendingServerV2 exists, otherwise the server object
     */
    static safeGet(serverId: Snowflake): Optional<AttendingServerV2> {
        return AttendingServerV2.allServers.get(serverId);
    }

    /**
     * Adds a student to the notification group
     * @param studentMember student to add
     * @param targetQueue which notification group to add to
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
     * Send an announcement to all the students in the helper's approved queues
     * @param helperMember helper that used /announce
     * @param announcement announcement message
     * @param targetQueue optional, specifies which queue to announce to
     * @throws {ServerError} if the helper doesn't have the queue role of targetQueue if specified
     * - if there's no one to announce to in any of the queues
     */
    async announceToStudentsInQueue(
        helperMember: GuildMember,
        announcement: string,
        targetQueue?: QueueChannel
    ): Promise<void> {
        if (targetQueue !== undefined) {
            const queueToAnnounce = this._queues.get(targetQueue.parentCategoryId);
            const hasQueueRole = helperMember.roles.cache.some(
                role =>
                    role.name === targetQueue.queueName || role.id === this.botAdminRoleID
            );
            if (!queueToAnnounce || !hasQueueRole) {
                throw ExpectedServerErrors.noAnnouncePerm(targetQueue.queueName);
            }
            const announcementEmbed = SimpleEmbed(
                `Staff member ${helperMember.displayName} announced:\n${announcement}`,
                EmbedColor.Aqua,
                `In queue: ${targetQueue.queueName}`
            );
            await Promise.all(
                queueToAnnounce.students.map(student =>
                    student.member.send(announcementEmbed)
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
        const announcementEmbed = SimpleEmbed(
            `Staff member ${helperMember.displayName} announced:`,
            EmbedColor.Aqua,
            announcement
        );
        await Promise.all(
            studentsToAnnounceTo.map(student => student.member.send(announcementEmbed))
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
     * Clear all queues of this server
     * @remark separated from {@link clearQueue} to avoid excessive backup calls
     */
    async clearAllQueues(): Promise<void> {
        await Promise.all(this._queues.map(queue => queue.removeAllStudents()));
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
     * Closes all the queue that the helper has permission to & logs the help time to console
     * @param helperMember helper that used /stop
     * @throws {ServerError} if the helper is not hosting
     */
    async closeAllClosableQueues(helperMember: GuildMember): Promise<Required<Helper>> {
        const helper = this._helpers.get(helperMember.id);
        if (helper === undefined) {
            throw ExpectedServerErrors.notHosting;
        }
        this._helpers.delete(helperMember.id);
        const completeHelper: Required<Helper> = {
            ...helper,
            helpEnd: new Date()
        };
        console.log(
            ` - Help time of ${helper.member.displayName} is ${convertMsToTime(
                completeHelper.helpEnd.getTime() - completeHelper.helpStart.getTime()
            )}`
        );
        // this filter does not rely on user roles anymore
        // close all queues that has this user as a helper
        const closableQueues = this._queues.filter(queue =>
            queue.hasHelper(helperMember.id)
        );
        await Promise.all(closableQueues.map(queue => queue.closeQueue(helperMember)));
        await Promise.all(
            this.serverExtensions.map(extension =>
                extension.onHelperStopHelping(this, completeHelper)
            )
        );
        return completeHelper;
    }

    /**
     * Creates all the command access level roles
     * @param allowDuplicate if true, creates new roles even if they already exist
     * - Duplicates will be created if roles with the same name already exist
     * @param everyoneIsStudent whether to treat @ everyone as the student role
     */
    async createAccessLevelRoles(
        allowDuplicate: boolean,
        everyoneIsStudent: boolean
    ): Promise<void> {
        const allRoles = await this.guild.roles.fetch();
        const everyoneRoleId = this.guild.roles.everyone.id;
        const foundRoles = []; // sorted low to high
        const createdRoles = []; // not typed bc we are only using it for logging
        for (const role of this.sortedAccessLevelRoles) {
            // do the search in allRoles if it's NotSet, Deleted, or @everyone
            // so if existingRole is not undefined, it's one of @Bot Admin, @Staff or @Student
            const existingRole =
                role.id in SpecialRoleValues || role.id === everyoneRoleId
                    ? allRoles.find(serverRole => serverRole.name === role.displayName)
                    : allRoles.get(role.id);
            if (role.key === 'student' && everyoneIsStudent) {
                this.accessLevelRoleIds.student = everyoneRoleId;
                continue;
            }
            if (existingRole && !allowDuplicate) {
                this.accessLevelRoleIds[role.key] = existingRole.id;
                foundRoles[existingRole.position] = existingRole.name;
                continue;
            }
            const newRole = await this.guild.roles.create({
                ...accessLevelRoleConfigs[role.key],
                name: accessLevelRoleConfigs[role.key].displayName
            });
            this.accessLevelRoleIds[role.key] = newRole.id;
            // set by indices that are larger than arr length is valid in JS
            // ! do NOT do this with important arrays bc there will be 'empty items'
            createdRoles[newRole.position] = newRole.name;
        }
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
        createdRoles.length > 0
            ? console.log(blue('Created roles:'), createdRoles)
            : console.log(green(`All required roles exist in ${this.guild.name}!`));
        foundRoles.length > 0 && console.log('Found roles:', foundRoles);
    }

    /**
     * Creates a new office hour queue
     * @param newQueueName name for this queue
     * @throws {ServerError} if a queue with the same name already exists
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
            HelpQueueV2.create(queueChannel),
            this.createQueueRoles()
        ]);
        this._queues.set(parentCategory.id, helpQueue);
        await this.getQueueChannels(false);
    }

    /**
     * Deletes a queue by categoryID
     * @param parentCategoryId CategoryChannel.id of the target queue
     * @throws {ServerError} if no queue with ths parentCategoryId exists
     *  or the category itself doesn't exist
     */
    async deleteQueueById(parentCategoryId: string): Promise<void> {
        const queue = this._queues.get(parentCategoryId);
        if (queue === undefined) {
            throw ExpectedServerErrors.queueDoesNotExist;
        }
        // delete queue data model no matter if the category was deleted by the user
        // now only the queue variable holds the queue channel
        this._queues.delete(parentCategoryId);
        const allChannels = await this.guild.channels.fetch();
        const parentCategory = allChannels.find(
            (channel): channel is CategoryChannel =>
                isCategoryChannel(channel) && channel.id === parentCategoryId
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
     * Dequeue the student that has been waiting for the longest globally
     * @param helperMember the helper that used /next.
     * @returns the dequeued student
     * @throws {ServerError} if helper is not hosting, not in a voice channel, or all queues are empty
     */
    async dequeueGlobalFirst(helperMember: GuildMember): Promise<Readonly<Helpee>> {
        const currentlyHelpingQueues = this._queues.filter(queue =>
            queue.hasHelper(helperMember.id)
        );
        const helperObject = this._helpers.get(helperMember.id);
        if (currentlyHelpingQueues.size === 0 || !helperObject) {
            throw ExpectedServerErrors.notHosting;
        }
        const helperVoiceChannel = helperMember.voice.channel;
        if (helperVoiceChannel === null) {
            throw ExpectedServerErrors.notInVC;
        }
        const nonEmptyQueues = currentlyHelpingQueues.filter(queue => queue.length !== 0);
        // check must happen before reduce, reduce on empty arrays without initial value will throw an error
        // in this case there's no valid initial value if there's no queue to dequeue from at all
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
            sendInvite(student.member, helperVoiceChannel),
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
     * @param helperMember the helper that used /next
     * @param targetStudentMember if specified, remove this student and override queue order
     * @param targetQueue if specified, dequeue from this queue
     * - If both are specified, only look for the targetStudentMember in specificQueue
     * @returns the dequeued student
     * @throws {ServerError}
     * - for the same reasons as {@link dequeueGlobalFirst}
     * - if targetQueue is specified and it doesn't exist
     * - if targetStudentMember is specified but not present in any queue
     */
    async dequeueWithArguments(
        helperMember: GuildMember,
        targetStudentMember?: GuildMember,
        targetQueue?: QueueChannel
    ): Promise<Readonly<Helpee>> {
        const currentlyHelpingQueues = this._queues.filter(queue =>
            queue.hasHelper(helperMember.id)
        );
        const helperObject = this._helpers.get(helperMember.id);
        if (currentlyHelpingQueues.size === 0 || !helperObject) {
            console.log(currentlyHelpingQueues.size, helperObject);
            throw ExpectedServerErrors.notHosting;
        }
        const helperVoiceChannel = helperMember.voice.channel;
        if (helperVoiceChannel === null) {
            throw ExpectedServerErrors.notInVC;
        }
        let student: Readonly<Helpee>;
        if (targetQueue !== undefined) {
            // if queue is specified, find the queue and let queue dequeue
            const queueToDequeue = this._queues.get(targetQueue.parentCategoryId);
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
            sendInvite(student.member, helperVoiceChannel),
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
     * Attempt to enqueue a student
     * @param studentMember student member to enqueue
     * @param queueChannel target queue
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
     * Gets a queue channel by the parent category id
     * @param parentCategoryId the associated parent category id
     * @returns queue channel object if it exists, undefined otherwise
     */
    getQueueChannelById(parentCategoryId: Snowflake): Optional<QueueChannel> {
        return this._queues.get(parentCategoryId)?.queueChannel;
    }

    /**
     * Gets all the queue channels on the server.
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
     * Called when leaving a server. **This is the only way to delete an AttendingServer**
     * - let all the extensions clean up their own memory first before deleting them
     * @returns true if this server existed and has been removed, or false if the element does not exist.
     */
    async gracefulDelete(): Promise<boolean> {
        this.clearAllServerTimers();
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerDelete(this))
        );
        return AttendingServerV2.allServers.delete(this.guild.id);
    }

    /**
     * Notify all helpers of the topic that the student requires help with
     * @param studentMember the student that just submitted the help topic modal
     * @param queueChannel related queue channel
     * @param topic the submitted help topic content
     */
    async notifyHelpersOnStudentSubmitHelpTopic(
        studentMember: GuildMember,
        queueChannel: QueueChannel,
        topic: string
    ): Promise<void> {
        await this._queues
            .get(queueChannel.parentCategoryId)
            ?.notifyHelpersOn('submitHelpTopic', studentMember, topic);
    }

    /**
     * Called when a member joins a voice channel
     * - triggers onStudentJoinVC for all extensions if the member is a
     * student and was just removed from the queue
     * @param member the guild member that just joined a VC
     * @param newVoiceState voice state object with a guaranteed non-null channel
     */
    async onMemberJoinVC(
        member: GuildMember,
        newVoiceState: WithRequired<VoiceState, 'channel'>
    ): Promise<void> {
        // temporary solution, stage channel is not currently supported
        if (!isVoiceChannel(newVoiceState.channel)) {
            return;
        }
        const voiceChannel = newVoiceState.channel;
        const memberIsStudent = this._helpers.some(helper =>
            helper.helpedMembers.some(
                helpedMember => helpedMember.member.id === member.id
            )
        );
        const memberIsHelper = this._helpers.has(member.id);
        if (memberIsStudent) {
            const queuesToRerender = this.queues.filter(queue =>
                newVoiceState.channel.members.some(vcMember =>
                    queue.hasHelper(vcMember.id)
                )
            );
            await Promise.all([
                ...this.serverExtensions.map(extension =>
                    extension.onStudentJoinVC(this, member, voiceChannel)
                ),
                ...queuesToRerender.map(queue => queue.triggerRender())
            ]);
        }
        if (memberIsHelper) {
            await Promise.all(
                this.queues.map(
                    queue => queue.hasHelper(member.id) && queue.triggerRender()
                )
            );
        }
    }

    /**
     * Called when a member leaves a voice channel
     * - triggers onStudentLeaveVC for all extensions if the member is a
     * student and was in a session
     * @param member the guild member that just joined a VC
     * @param oldVoiceState voice state object with a guaranteed non-null channel
     */
    async onMemberLeaveVC(
        member: GuildMember,
        oldVoiceState: WithRequired<VoiceState, 'channel'>
    ): Promise<void> {
        const memberIsStudent = this._helpers.some(helper =>
            helper.helpedMembers.some(
                helpedMember => helpedMember.member.id === member.id
            )
        );
        const memberIsHelper = this._helpers.has(member.id);
        if (memberIsStudent) {
            // filter queues where some member of that voice channel is a helper of that queue
            const queuesToRerender = this.queues.filter(queue =>
                oldVoiceState.channel.members.some(vcMember =>
                    queue.hasHelper(vcMember.id)
                )
            );
            await Promise.all([
                ...oldVoiceState.channel.permissionOverwrites.cache.map(
                    overwrite => overwrite.id === member.id && overwrite.delete()
                ), // delete the student permission overwrite
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
                    queue => queue.hasHelper(member.id) && queue.triggerRender()
                )
            );
        }
    }

    /**
     * Checks the deleted `role` was a access level role and if so, mark as deleted
     * @param deletedRole the role that was deleted
     */
    async onRoleDelete(deletedRole: Role): Promise<void> {
        let accessLevelRoleDeleted = false;
        // shorthand syntax to take the properties of an object with the same name
        for (const { key, id } of this.sortedAccessLevelRoles) {
            if (deletedRole.id === id) {
                this.accessLevelRoleIds[key] = SpecialRoleValues.Deleted;
                accessLevelRoleDeleted = true;
            }
        }
        if (!accessLevelRoleDeleted) {
            return;
        }
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Opens all the queue that the helper has permission to
     * @param helperMember helper that used /start
     * @param notify whether to notify the students in queue
     * @throws ServerError
     * - If the helper doesn't have any class roles
     * - If the helper is already hosting
     */
    async openAllOpenableQueues(
        helperMember: GuildMember,
        notify: boolean
    ): Promise<void> {
        if (this._helpers.has(helperMember.id)) {
            throw ExpectedServerErrors.alreadyHosting;
        }
        const helperRoles = helperMember.roles.cache.map(role => role.name);
        const openableQueues = this._queues.filter(queue =>
            helperRoles.includes(queue.queueName)
        );
        if (openableQueues.size === 0) {
            throw ExpectedServerErrors.missingClassRole;
        }
        // create this object after all checks have passed
        const helper: Helper = {
            helpStart: new Date(),
            helpedMembers: [],
            activeState: 'active', // always start with active state
            member: helperMember
        };
        this._helpers.set(helperMember.id, helper);
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
     * Marks a helper as 'paused'. Used for the '/pause' command
     * @param helperMember the active helper to be marked as 'paused'
     * @returns whether there are other active helpers
     * @throws ServerError if
     * - helper is not hosting
     * - helper is already paused
     */
    async pauseHelping(helperMember: GuildMember): Promise<boolean> {
        const helper = this._helpers.get(helperMember.id);
        if (!helper) {
            throw ExpectedServerErrors.notHosting;
        }
        if (helper.activeState === 'paused') {
            throw ExpectedServerErrors.alreadyPaused;
        }
        helper.activeState = 'paused';
        const pauseableQueues = this._queues.filter(queue =>
            queue.activeHelperIds.has(helperMember.id)
        );
        await Promise.all(
            pauseableQueues.map(queue => queue.markHelperAsPaused(helperMember))
        );
        const existOtherActiveHelpers = pauseableQueues.some(
            queue => queue.activeHelperIds.size > 0
        );
        return existOtherActiveHelpers;
    }

    /**
     * Removes a student from the notification group
     * @param studentMember student to add
     * @param targetQueue which notification group to remove from
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
     * Removes a student from a given queue
     * @param studentMember student that used /leave or the leave button
     * @param targetQueue the queue to leave from
     * @throws QueueError: if targetQueue rejects
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
     * Changes the helper state from paused to active
     * @param helperMember a paused helper to resume helping
     */
    async resumeHelping(helperMember: GuildMember): Promise<void> {
        const helper = this._helpers.get(helperMember.id);
        if (!helper) {
            throw ExpectedServerErrors.notHosting;
        }
        if (helper.activeState === 'active') {
            throw ExpectedServerErrors.alreadyActive;
        }
        helper.activeState = 'active';
        const resumableQueues = this._queues.filter(queue =>
            queue.pausedHelperIds.has(helperMember.id)
        );
        await Promise.all(
            resumableQueues.map(queue => queue.markHelperAsActive(helperMember))
        );
    }

    /**
     * Sends the log message to the logging channel if it's set up
     * @param message message to log
     */
    sendLogMessage(message: BaseMessageOptions | string): void {
        if (this.loggingChannel) {
            this.loggingChannel.send(message).catch(err => {
                console.error(red(`Failed to send logs to ${this.guild.name}.`));
                console.error(err);
            });
        }
    }

    /**
     * Sets the access level roles to use for this server
     * @param role name of the role; botAdmin, staff, or student
     * @param id the role id snowflake
     */
    async setAccessLevelRoleId(role: AccessLevelRole, id: Snowflake): Promise<void> {
        this.settings.accessLevelRoleIds[role] = id;
        await Promise.all([
            updateCommandHelpChannelVisibility(
                this.guild,
                this.settings.accessLevelRoleIds
            ),
            ...this.serverExtensions.map(extension =>
                extension.onServerRequestBackup(this)
            )
        ]);
    }

    /**
     * Sets the after session message for this server
     * @param newMessage after session message to set
     * - Side Effect: Triggers a firebase backup
     */
    async setAfterSessionMessage(newMessage: string): Promise<void> {
        this.settings.afterSessionMessage = newMessage;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sets the internal boolean value for autoGiveStudentRole
     * @param autoGiveStudentRole on or off
     */
    async setAutoGiveStudentRole(autoGiveStudentRole: boolean): Promise<void> {
        this.settings.autoGiveStudentRole = autoGiveStudentRole;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sets the logging channel for this server
     * @param loggingChannel the new logging channel.
     * - If undefined, disables logging for this server
     */
    async setLoggingChannel(loggingChannel?: TextChannel): Promise<void> {
        this.settings.loggingChannel = loggingChannel;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sets the internal boolean value for promptHelpTopic
     * @param promptHelpTopic
     */
    async setPromptHelpTopic(promptHelpTopic: boolean): Promise<void> {
        this.settings.promptHelpTopic = promptHelpTopic;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sets up queue auto clear for this server
     * @param hours the number of hours to wait before clearing the queue
     * @param minutes the number of minutes to wait before clearing the queue
     * @param enable whether to disable auto clear, overrides hours` and `minutes`
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
     * Sets the serious server flag, and updates the queues if seriousness is changed
     * @param enableSeriousMode turn on or off serious mode
     * @returns True if triggered renders for all queues
     */
    async setSeriousServer(enableSeriousMode: boolean): Promise<boolean> {
        const seriousState = this.queues[0]?.isSerious ?? false;
        if (seriousState === enableSeriousMode) {
            return false;
        }
        await Promise.all([
            ...this._queues.map(queue => queue.setSeriousMode(enableSeriousMode)),
            ...this.serverExtensions.map(extension =>
                extension.onServerRequestBackup(this)
            )
        ]);
        return true;
    }

    /**
     * Cleans up all the timers from setInterval
     */
    private clearAllServerTimers(): void {
        this._queues.forEach(queue => queue.clearAllQueueTimers());
    }

    /**
     * Creates roles for all the available queues if not already created
     */
    private async createQueueRoles(): Promise<void> {
        // use a set to collect the unique role names
        const existingRoles = new Set(this.guild.roles.cache.map(role => role.name));
        const queueNames = (await this.getQueueChannels(false)).map(
            channel => channel.queueName
        );
        // for each queueName, if it's not in existingRoles, create it
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

    /**
     * Creates all the office hour queues
     * @param queueBackups the queue data to load
     * @param hoursUntilAutoClear how long until the queues are cleared
     * @param seriousModeEnabled show fun stuff in queues or not, synced with the server object
     */
    private async initializeAllQueues(
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
                    await HelpQueueV2.create(channel, completeBackup)
                );
            })
        );
        console.log(
            `All queues in '${this.guild.name}' successfully created ${
                environment.disableExtensions ? '' : blue('with their extensions')
            }!`
        );
        await Promise.all(
            this.serverExtensions.map(extension =>
                extension.onAllQueuesInit(this, this.queues)
            )
        );
    }

    /**
     * Loads the server settings data from a backup
     * - queue backups are passed to the queue constructors
     * @param backup the data to load
     */
    private loadBackup(backup: ServerBackup): void {
        console.log(cyan(`Restoring external backup for ${this.guild.name}.`));
        this.settings = {
            ...backup,
            accessLevelRoleIds: {
                botAdmin: backup.botAdminRoleId,
                staff: backup.staffRoleId,
                student: backup.studentRoleId
            }
        };
        const loggingChannelFromBackup = this.guild.channels.cache.get(
            backup.loggingChannelId
        );
        if (isTextChannel(loggingChannelFromBackup)) {
            this.settings.loggingChannel = loggingChannelFromBackup;
        }
    }
}

export { AttendingServerV2, QueueChannel };
