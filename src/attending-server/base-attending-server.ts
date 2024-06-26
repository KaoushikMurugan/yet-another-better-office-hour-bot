/** @module AttendingServerV2 */
import type { Logger } from 'pino';
import type { QueueChannel } from '../models/queue-channel.js';

import {
    BaseMessageOptions,
    CategoryChannel,
    ChannelType,
    Collection,
    Guild,
    GuildMember,
    Role,
    Snowflake,
    TextChannel,
    VoiceState
} from 'discord.js';
import { environment } from '../environment/environment-manager.js';
import { ServerExtension } from '../extensions/extension-interface.js';
import { CalendarServerExtension } from '../extensions/session-calendar/calendar-server-extension.js';
import { LOGGER } from '../global-states.js';
import { AutoClearTimeout, HelpQueue } from '../help-queue/help-queue.js';
import {
    AccessLevelRole,
    AccessLevelRoleIds,
    accessLevelRoleConfigs
} from '../models/access-level-roles.js';
import { QueueBackup, ServerBackup } from '../models/backups.js';
import { Helpee, Helper } from '../models/member-states.js';
import { blue, green, red } from '../utils/command-line-colors.js';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper.js';
import {
    CategoryChannelId,
    GuildId,
    GuildMemberId,
    HelperRolesData,
    Optional,
    OptionalRoleId,
    SimpleTimeZone,
    SpecialRoleValues,
    WithRequired
} from '../utils/type-aliases.js';
import {
    convertMsToTime,
    isCategoryChannel,
    isTextChannel,
    isVoiceBasedChannel
} from '../utils/util-functions.js';
import { ExpectedServerErrors } from './expected-server-errors.js';
import {
    backupQueueData,
    loadExternalServerData,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    useFullBackup,
    // it is used idk why it complains
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    useSettingsBackup
} from './firebase-backup.js';
import {
    getExistingQueueChannels,
    initializationCheck,
    sendVoiceChannelInviteIfNotInVBC,
    setHelpChannelVisibility,
    updateCommandHelpChannels
} from './guild-actions.js';
import { RoleConfigMenuForServerInit } from './server-settings-menus.js';
import { HelperActivityTrackingExtension } from '../extensions/helper-activity-tracking/server-extension.js';

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
    /** Track data in Google sheet if true */
    trackingEnabled: boolean;
    /**
     * Role IDs are always snowflake strings (i.e. they are strings that only consist of numbers)
     * @see https://discord.com/developers/docs/reference#snowflakes
     * @remark Special values for role IDs:
     * - 'NotSet' means that the role is not set
     * - 'Deleted' means that the role was deleted
     */
    accessLevelRoleIds: AccessLevelRoleIds;
    /**
     * Timezone of the server, defaults to utc (sign = +, hours = 0, minutes = 0)
     */
    timezone: SimpleTimeZone;
};

/**
 * Represents 1 server that this YABOB is a member of.
 * - Public functions can be accessed by the command handler
 * - Variables with an underscore has a public getter, but only mutable inside the class
 */
class AttendingServer {
    /**
     * All the servers that YABOB is managing
     * @remark Do NOT call the {@link AttendingServer} methods (except getters)
     * without passing through a interaction handler first
     * - equivalent to the old attendingServers global object
     */
    private static readonly allServers = new Collection<GuildId, AttendingServer>();
    /**
     * Unique helpers (both active and paused)
     * - Key is GuildMember.id
     */
    private _helpers = new Collection<GuildMemberId, Helper>();
    /**
     * All the queues of this server
     * - Key is CategoryChannel.id of the parent category of #queue
     */
    private _queues = new Collection<CategoryChannelId, HelpQueue>();
    /**
     * Server settings. An firebase update is requested as soon as this changes
     */
    private settings: ServerSettings = {
        afterSessionMessage: '',
        autoGiveStudentRole: false,
        promptHelpTopic: true,
        trackingEnabled: false,
        accessLevelRoleIds: {
            botAdmin: SpecialRoleValues.NotSet,
            staff: SpecialRoleValues.NotSet,
            student: SpecialRoleValues.NotSet
        },
        timezone: {
            sign: '-',
            hours: 7,
            minutes: 0
        }
    };

    private logger: Logger;

    protected constructor(
        readonly guild: Guild,
        readonly serverExtensions: readonly ServerExtension[]
    ) {
        this.logger = LOGGER.child({ guild: this.guild.name });
    }

    /**
     * Number of correctly initialized AttendingServers
     */
    static get activeServersCount(): number {
        return AttendingServer.allServers.size;
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

    get guildId(): Snowflake {
        return this.guild.id;
    }

    /** All the helpers on this server, both active and paused */
    get helpers(): ReadonlyMap<string, Helper> {
        return this._helpers;
    }

    /** Timezone of the server */
    get timezone(): Readonly<SimpleTimeZone> {
        return this.settings.timezone;
    }

    /**
     * Returns true if the server is in serious mode
     * @returns boolean, defaults to false if no queues exist on this server
     */
    get isSerious(): boolean {
        return HelpQueue.sharedSettings.get(this.guildId)?.seriousModeEnabled ?? false;
    }

    /** The logging channel on this server. undefined if not set */
    get loggingChannel(): Optional<TextChannel> {
        return this.settings.loggingChannel;
    }

    /** whether to prompt modal asking for help topic when a user joins a queue */
    get promptHelpTopic(): boolean {
        return this.settings.promptHelpTopic;
    }

    /** Track data in Google sheet if true */
    get trackingEnabled(): boolean {
        return this.settings.trackingEnabled;
    }

    /** Auto clear values of a queue, undefined if not set */
    get queueAutoClearTimeout(): Optional<AutoClearTimeout> {
        return this._queues.first()?.timeUntilAutoClear;
    }

    get queueChannels(): readonly QueueChannel[] {
        return this._queues.map(queue => queue.queueChannel);
    }

    /** List of category channel IDs on this server */
    get categoryChannelIDs(): readonly CategoryChannelId[] {
        return [...this._queues.keys()];
    }

    /** List of queues on this server */
    get queues(): readonly HelpQueue[] {
        return [...this._queues.values()];
    }

    /**
     * Returns an array of the roles for this server in the order [Bot Admin, Helper, Student]
     */
    get sortedAccessLevelRoles() {
        return [
            {
                key: 'botAdmin',
                displayName: accessLevelRoleConfigs.botAdmin.displayName,
                id: this.settings.accessLevelRoleIds.botAdmin
            },
            {
                key: 'staff',
                displayName: accessLevelRoleConfigs.staff.displayName,
                id: this.settings.accessLevelRoleIds.staff
            },
            {
                key: 'student',
                displayName: accessLevelRoleConfigs.student.displayName,
                id: this.settings.accessLevelRoleIds.student
            }
        ] as const;
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
     * Returns the highest access level role of a member.
     * Undefined if the member doesn't have any
     */
    getHighestAccessLevelRole(member: GuildMember): Optional<AccessLevelRole> {
        const highestRole = this.sortedAccessLevelRoles
            .map(role => role.id)
            .filter(roleId => member.roles.cache.has(roleId))
            .at(0);
        return this.sortedAccessLevelRoles.find(role => role.id === highestRole)?.key;
    }

    /**
     * Asynchronously creates a YABOB instance for 1 server
     * @param guild the server for YABOB to join
     * @returns a created instance of YABOB
     * @throws {Error} if any setup functions fail (uncaught)
     */
    static async create(guild: Guild): Promise<AttendingServer> {
        await initializationCheck(guild);
        // Load ServerExtensions here
        const serverExtensions: readonly ServerExtension[] = environment.disableExtensions
            ? []
            : await Promise.all([
                  CalendarServerExtension.load(guild),
                  new HelperActivityTrackingExtension(guild)
              ]);
        const server = new AttendingServer(guild, serverExtensions);
        const externalBackup = environment.disableExtensions
            ? undefined
            : await loadExternalServerData(guild.id);

        if (externalBackup !== undefined) {
            server.loadBackup(externalBackup);
        }

        const accessLevelRolesAreMissing = server.sortedAccessLevelRoles.some(
            role =>
                role.id === SpecialRoleValues.NotSet ||
                role.id === SpecialRoleValues.Deleted ||
                !guild.roles.cache.has(role.id)
        );

        if (accessLevelRolesAreMissing) {
            guild
                .fetchOwner()
                .then(owner => owner.send(RoleConfigMenuForServerInit(server, false)))
                .catch(err => LOGGER.error(err));
        }

        await Promise.all([
            server.initializeAllQueues(
                externalBackup?.queues,
                externalBackup?.hoursUntilAutoClear
            ),
            server.createQueueRoles(),
            updateCommandHelpChannels(guild, server.accessLevelRoleIds)
        ]).catch(err => {
            LOGGER.error(err);
            throw new Error(`❗ ${red(`Initialization for ${guild.name} failed.`)}`);
        });
        await Promise.all(
            serverExtensions.map(extension => extension.onServerInitSuccess(server))
        );

        AttendingServer.allServers.set(guild.id, server);
        LOGGER.info(`⭐ ${green(`Initialization for ${guild.name} is successful!`)}`);

        return server;
    }

    /**
     * Gets a AttendingServerV2 object by Id
     * @param serverId guild Id
     * @returns the corresponding server object
     * @throws {ServerError} if no server with this server id exists
     */
    static get(serverId: Snowflake): AttendingServer {
        const server = AttendingServer.allServers.get(serverId);
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
    static safeGet(serverId: Snowflake): Optional<AttendingServer> {
        return AttendingServer.allServers.get(serverId);
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
     * Clear all queues of this server
     * @remark separated from {@link clearQueueById} to avoid excessive backup calls
     */
    @useFullBackup
    async clearAllQueues(): Promise<void> {
        await Promise.all(this._queues.map(queue => queue.removeAllStudents()));
    }

    /**
     * Clears a given queue by its id
     * @param parentCategoryId
     */
    async clearQueueById(parentCategoryId: CategoryChannelId): Promise<void> {
        await this.getQueueById(parentCategoryId).removeAllStudents();
        // temporary solution, regular clear_queue needs to be separated from clear all to avoid excessive backups
        backupQueueData(this.getQueueById(parentCategoryId));
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
        this.logger.info(
            `Help time of ${helper.member.displayName} is ${convertMsToTime(
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
    @useSettingsBackup
    async createAccessLevelRoles(
        allowDuplicate: boolean,
        everyoneIsStudent: boolean
    ): Promise<void> {
        const allRoles = await this.guild.roles.fetch();
        const everyoneRoleId = this.guild.roles.everyone.id;
        const foundRoles = []; // sorted low to high
        const createdRoles = []; // not typed bc we are only using it for logging

        for (const { key, displayName, id } of this.sortedAccessLevelRoles) {
            // do the search in allRoles if it's NotSet, Deleted, or @everyone
            // so if existingRole is not undefined, it's one of @Bot Admin, @Staff or @Student
            const existingRole =
                id in SpecialRoleValues || id === everyoneRoleId
                    ? allRoles.find(serverRole => serverRole.name === displayName)
                    : allRoles.get(id);
            if (key === 'student' && everyoneIsStudent) {
                this.accessLevelRoleIds.student = everyoneRoleId;
                continue;
            }
            if (existingRole && !allowDuplicate) {
                this.accessLevelRoleIds[key] = existingRole.id;
                foundRoles[existingRole.position] = existingRole.name;
                continue;
            }
            const newRole = await this.guild.roles.create({
                ...accessLevelRoleConfigs[key],
                name: accessLevelRoleConfigs[key].displayName
            });
            this.accessLevelRoleIds[key] = newRole.id;
            // set by indices that are larger than arr length is valid in JS
            // ! do NOT do this with important arrays bc there will be 'empty items'
            createdRoles[newRole.position] = newRole.name;
        }

        setHelpChannelVisibility(this.guild, this.accessLevelRoleIds).catch(err =>
            this.logger.error(err, 'Failed to update help channel visibilities.')
        );
        this.logger.info(
            createdRoles.length > 0
                ? `Created roles: ${createdRoles}`
                : `All required roles exist in ${this.guild.name}!`
        );

        if (foundRoles.length > 0) {
            this.logger.info(`Found roles: ${foundRoles}`);
        }
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
            textChannel: queueTextChannel,
            queueName: newQueueName,
            parentCategoryId: parentCategory.id
        };
        const [helpQueue] = await Promise.all([
            HelpQueue.create(queueChannel),
            this.createQueueRoles()
        ]);

        this._queues.set(parentCategory.id, helpQueue);
    }

    /**
     * Updates the queue name for queue embeds, roles, and calendar extension
     * @param oldCategory Old category channel before the name was updated
     * @param newCategory New category channel after the name was updated
     */
    async updateQueueName(oldCategory: CategoryChannel, newCategory: CategoryChannel) {
        const newName = newCategory.name;
        const queueToRename = this._queues.get(oldCategory.id);

        if (!queueToRename) {
            return;
        }

        const role = this.guild.roles.cache.find(role => role.name === oldCategory.name);
        const newQueueChannel: QueueChannel = {
            ...queueToRename.queueChannel,
            queueName: newName
        };
        const queueNameTaken = this._queues.some(queue => queue.queueName === newName);
        const roleNameTaken = this.guild.roles.cache.some(
            role => role.name === newCategory.name
        );

        if (queueNameTaken) {
            throw ExpectedServerErrors.queueAlreadyExists(newName);
        }
        if (role && !roleNameTaken) {
            await role.setName(newName);
        }

        await queueToRename.updateQueueChannel(newQueueChannel);
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

        if (parentCategory) {
            // if deleting through '/queue remove' command
            // delete child channels first
            await Promise.all(parentCategory.children.cache.map(child => child.delete()));
            // now delete category and role
            await Promise.all([
                parentCategory.delete(),
                this.guild.roles.cache
                    .find(role => role.name === parentCategory.name)
                    ?.delete()
            ]);
        }

        // let queue call onQueueDelete
        await queue.gracefulDelete();
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

        const helperVoiceBasedChannel = helperMember.voice.channel;
        if (helperVoiceBasedChannel === null) {
            throw ExpectedServerErrors.notInVBC;
        }

        const nonEmptyQueues = currentlyHelpingQueues.filter(queue => queue.length !== 0);
        // check must happen before reduce, reduce on empty arrays without initial value will throw an error
        // in this case there's no valid initial value if there's no queue to dequeue from at all
        if (nonEmptyQueues.size === 0) {
            throw ExpectedServerErrors.noOneToHelp;
        }

        const queueToDequeue = nonEmptyQueues.reduce<HelpQueue>(
            (prev, curr) =>
                prev.first &&
                curr.first &&
                prev.first.waitStart.getTime() < curr.first.waitStart.getTime()
                    ? prev // if the first 2 conditions passed,
                    : curr // both prev.first and curr.first will not be undefined
        );
        const student = await queueToDequeue.dequeueWithHelper(helperMember);
        helperObject.helpedMembers.push(student);
        const [inviteStatus] = await Promise.all([
            sendVoiceChannelInviteIfNotInVBC(student.member, helperVoiceBasedChannel),
            ...this.serverExtensions.map(extension =>
                extension.onDequeueFirst(this, student)
            )
        ]);

        if (!inviteStatus.ok) {
            throw inviteStatus.error;
        }

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
            throw ExpectedServerErrors.notHosting;
        }

        const helperVoiceBasedChannel = helperMember.voice.channel;
        if (helperVoiceBasedChannel === null) {
            throw ExpectedServerErrors.notInVBC;
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
        const [inviteStatus] = await Promise.all([
            sendVoiceChannelInviteIfNotInVBC(student.member, helperVoiceBasedChannel),
            ...this.serverExtensions.map(extension =>
                extension.onDequeueFirst(this, student)
            )
        ]);

        if (!inviteStatus.ok) {
            throw inviteStatus.error;
        }
        return student;
    }

    /**
     * Gets a help queue by parent category id
     * @param parentCategoryId the associated parent category id
     * @returns the queue object
     * @throws {ServerError} if no such queue
     */
    getQueueById(parentCategoryId: Snowflake): HelpQueue {
        const queue = this._queues.get(parentCategoryId);
        if (!queue) {
            throw ExpectedServerErrors.queueDoesNotExist;
        }

        return queue;
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
     * Called when leaving a server. **This is the only way to delete an AttendingServer**
     * - let all the extensions clean up their own memory first before deleting them
     * @returns true if this server existed and has been removed, or false if the element does not exist.
     */
    async gracefulDelete(): Promise<boolean> {
        this._queues.forEach(queue => queue.clearAllQueueTimers());
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerDelete(this))
        );
        return AttendingServer.allServers.delete(this.guild.id);
    }

    /**
     * Called when a member joins a voice channel
     * - triggers onStudentJoinVBC for all extensions if the member is a
     * student and was just removed from the queue
     * @param member the guild member that just joined a VBC
     * @param newVoiceState voice state object with a guaranteed non-null channel
     */
    async onMemberJoinVBC(
        member: GuildMember,
        newVoiceState: WithRequired<VoiceState, 'channel'>
    ): Promise<void> {
        if (!isVoiceBasedChannel(newVoiceState.channel)) {
            return;
        }

        const voiceBasedChannel = newVoiceState.channel;
        const memberIsStudent = this._helpers.some(
            helper =>
                helper.helpedMembers.some(
                    helpedMember => helpedMember.member.id === member.id
                ) || this.queues.some(queue => queue.hasStudent(member.id))
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
                    extension.onStudentJoinVBC(this, member, voiceBasedChannel)
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
     * - triggers onStudentLeaveVBC for all extensions if the member is a
     * student and was in a session
     * @param member the guild member that just joined a VBC
     * @param oldVoiceState voice state object with a guaranteed non-null channel
     */
    async onMemberLeaveVBC(
        member: GuildMember,
        oldVoiceState: WithRequired<VoiceState, 'channel'>
    ): Promise<void> {
        const memberIsStudent = this._helpers.some(
            helper =>
                helper.helpedMembers.some(
                    helpedMember => helpedMember.member.id === member.id
                ) || this.queues.some(queue => queue.hasStudent(member.id))
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
                    extension.onStudentLeaveVBC(this, member)
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
    @useSettingsBackup
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
            throw ExpectedServerErrors.noQueueRole;
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
            this.loggingChannel
                .send(message)
                .catch(err => this.logger.error(err, 'Failed to send logs.'));
        }
    }

    /**
     * Sets the access level roles to use for this server
     * @param role name of the role; botAdmin, staff, or student
     * @param id the role id snowflake
     */
    @useSettingsBackup
    setAccessLevelRoleId(role: AccessLevelRole, id: Snowflake): void {
        this.settings.accessLevelRoleIds[role] = id;
        Promise.all([
            setHelpChannelVisibility(this.guild, this.settings.accessLevelRoleIds)
        ]).catch(err => {
            this.logger.error(err, 'Failed to set roles');
            this.sendLogMessage(`Failed to set roles in ${this.guild.name}`);
        });
    }

    /**
     * Sets the after session message for this server
     * @param newMessage after session message to set
     * - Side Effect: Triggers a firebase backup
     */
    @useSettingsBackup
    async setAfterSessionMessage(newMessage: string): Promise<void> {
        this.settings.afterSessionMessage = newMessage;
    }

    /**
     * Sets the internal boolean value for autoGiveStudentRole
     * @param autoGiveStudentRole on or off
     */
    @useSettingsBackup
    async setAutoGiveStudentRole(autoGiveStudentRole: boolean): Promise<void> {
        this.settings.autoGiveStudentRole = autoGiveStudentRole;
    }

    /**
     * Sets the logging channel for this server
     * @param loggingChannel the new logging channel.
     * - If undefined, disables logging for this server
     */
    @useSettingsBackup
    async setLoggingChannel(loggingChannel?: TextChannel): Promise<void> {
        this.settings.loggingChannel = loggingChannel;
    }

    /**
     * Sets the internal boolean value for promptHelpTopic
     * @param promptHelpTopic
     */
    @useSettingsBackup
    async setPromptHelpTopic(promptHelpTopic: boolean): Promise<void> {
        this.settings.promptHelpTopic = promptHelpTopic;
    }

    /**
     * Sets the internal boolean value for sheetTracking
     * @param enabled
     */
    @useSettingsBackup
    setTrackingEnabled(enabled: boolean): void {
        this.settings.trackingEnabled = enabled;
    }

    /**
     * Sets up queue auto clear for this server
     * @param hours the number of hours to wait before clearing the queue
     * @param minutes the number of minutes to wait before clearing the queue
     * @param enable whether to disable auto clear, overrides hours` and `minutes`
     */
    @useSettingsBackup
    async setQueueAutoClear(
        hours: number,
        minutes: number,
        enable: boolean
    ): Promise<void> {
        this._queues.forEach(queue => queue.setAutoClear(hours, minutes, enable));
    }

    /**
     * Sets the serious server flag, and updates the queues if seriousness is changed
     * @param enable turn on or off serious mode
     * @returns True if triggered renders for all queues
     */
    @useSettingsBackup
    async setSeriousServer(enable: boolean): Promise<void> {
        this._queues.forEach(queue => queue.setSeriousMode(enable));
    }

    @useSettingsBackup
    async setTimeZone(newTimeZone: SimpleTimeZone): Promise<void> {
        this.settings.timezone = newTimeZone;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onTimeZoneChange(this))
        );
    }

    /**
     * Assigns users to the queue roles based on the data provided. Gives the staff role to the user if they don't have it already.
     *
     * **Warning**: Role names in the data array must match the queue names / roles exactly. It is *case sensitive*.
     * @param helpersRolesData
     * @returns Log of successfully assigned roles and errors
     */
    async assignHelpersRoles(
        helpersRolesData: HelperRolesData[]
    ): Promise<[logMap: Map<string, string>, errorMap: Map<string, string>]> {
        // for each helper id in helpersRolesData, remove preexisting queue roles and assign the queues roles using the queue name listed in the data array
        const queueNames = this.queues.map(queue => queue.queueName);
        // ensure the queue roles exist so that queueRoles is guaranteed to not contain undefined
        await this.createQueueRoles();
        // find the roles that match the queue names
        const queueRoles = queueNames
            .map(queueName =>
                this.guild.roles.cache.find(role => role.name === queueName)
            )
            .filter((role): role is Role => role !== undefined);
        const logMap: Map<string, string> = new Map();
        const errorMap: Map<string, string> = new Map();

        if (this.accessLevelRoleIds.staff === SpecialRoleValues.NotSet) {
            errorMap.set('Warning', 'Staff role has not been set up yet.');
        }
        if (this.accessLevelRoleIds.staff === SpecialRoleValues.Deleted) {
            errorMap.set(
                'Warning',
                "Staff role has been deleted. Wasn't able to assign staff role to helpers."
            );
        }

        // the fetch call refreshes the cache as a side effect
        const guildMembers = await this.guild.members.fetch();
        const promises = helpersRolesData.map(async data => {
            if (!guildMembers.has(data.helperId)) {
                errorMap.set(
                    data.helperId,
                    `Failed to find member with id ${data.helperId} in this server.`
                );
                return;
            }

            const helper = await this.guild.members.fetch(data.helperId);
            // give the helper the staff role if they don't have it
            if (!helper.roles.cache.has(this.staffRoleID)) {
                await helper.roles.add(this.staffRoleID);
                logMap.set(
                    data.helperId,
                    `<@&${this.settings.accessLevelRoleIds.staff}> ${logMap.get(
                        data.helperId
                    )}`
                );
            }

            // remove old queue roles
            await helper.roles.remove(queueRoles);
            // get the queue roles from the helperRolesData
            if (data.queues.length === 0) {
                errorMap.set(
                    data.helperId,
                    `No queues were provided for helper with id ${data.helperId}.`
                );
            }

            const helperQueueRoles = data.queues
                .map(queueName => {
                    if (!queueNames.includes(queueName)) {
                        errorMap.set(
                            data.helperId,
                            `Failed to find queue with name ${queueName}.`
                        );
                        return undefined;
                    }
                    return queueRoles.find(role => role.name === queueName);
                })
                .filter((role): role is Role => role !== undefined);

            // add the new queue roles
            if (helperQueueRoles.length > 0) {
                await helper.roles.add(helperQueueRoles);
            }

            logMap.set(
                data.helperId,
                helperQueueRoles.map(role => role.toString()).join(' ')
            );
        });
        await Promise.all(promises);

        return [logMap, errorMap];
    }

    /**
     * Creates roles for all the available queues if not already created
     */
    private async createQueueRoles(): Promise<void> {
        // use a set to collect the unique role names
        const existingRoles = new Set(this.guild.roles.cache.map(role => role.name));
        const queueChannels = await getExistingQueueChannels(this.guild);
        if (!queueChannels.ok) {
            // TODO: temporary solution, this error should propagate somewhere
            return;
        }

        // for each queueName, if it's not in existingRoles, create it
        await Promise.all(
            queueChannels.value.map(async channel => {
                if (!existingRoles.has(channel.queueName)) {
                    await this.guild.roles.create({
                        name: channel.queueName,
                        position: 1
                    });
                }
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
        timeUntilAutoClear: AutoClearTimeout = 'AUTO_CLEAR_DISABLED',
        seriousModeEnabled = false
    ): Promise<void> {
        const queueChannels = await getExistingQueueChannels(this.guild);
        if (!queueChannels.ok) {
            // since this happens during initialization, we should abort
            throw queueChannels.error;
        }

        HelpQueue.sharedSettings.set(this.guildId, {
            timeUntilAutoClear,
            seriousModeEnabled
        });

        await Promise.all(
            queueChannels.value.map(async channel => {
                const backup = queueBackups?.find(
                    backup => backup.parentCategoryId === channel.parentCategoryId
                );
                this._queues.set(
                    channel.parentCategoryId,
                    await HelpQueue.create(channel, backup)
                );
            })
        );
        await Promise.all(
            this.serverExtensions.map(extension =>
                extension.onAllQueuesInit(this, this.queues)
            )
        );

        this.logger.info(
            `All queues successfully created${
                environment.disableExtensions ? '' : blue(' with their extensions')
            }!`
        );
    }

    /**
     * Loads the server settings data from a backup
     * - queue backups are passed to the queue constructors
     * @param backup the data to load
     */
    private loadBackup(backup: ServerBackup): void {
        this.logger.info(`Restoring external backup for ${this.guild.name}.`);
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

export { AttendingServer };
