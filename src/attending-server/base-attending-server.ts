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
import { hierarchyRoleConfigs, HierarchyRoles } from '../models/hierarchy-roles.js';
import { Helpee, Helper } from '../models/member-states.js';
import { IServerExtension } from '../extensions/extension-interface.js';
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
import { RolesConfigMenu } from './server-settings-menus.js';
import {
    initializationCheck,
    sendInvite,
    updateCommandHelpChannelVisibility,
    updateCommandHelpChannels
} from './guild-actions.js';
import { CalendarServerExtension } from '../extensions/session-calendar/calendar-server-extension.js';

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
    /** message sent to students after they leave */
    afterSessionMessage: string;
    /** optional, channel where yabob will log message. if undefined, don't log on the server */
    loggingChannel?: TextChannel;
    /** automatically give new members the student role */
    autoGiveStudentRole: boolean;
    /** prompt modal asking for help topic when a user joins a queue */
    promptHelpTopic: boolean;
    /**
     * Role IDs are always snowflake strings (i.e. they are strings that only consist of numbers)
     * @see https://discord.com/developers/docs/reference#snowflakes
     *
     * Special values for role IDs:
     * - 'Not Set' means that the role is not set
     * - 'Deleted' means that the role was deleted
     */
    hierarchyRoleIds: HierarchyRoles;
};

/**
 * V2 of AttendingServer. Represents 1 server that this YABOB is a member of
 * ----
 * - Public functions can be accessed by the command handler
 * - Variables with an underscore has a public getter, but only mutable inside the class
 */
class AttendingServerV2 {
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
     * Unique helpers (both active and paused)
     * - Key is GuildMember.id
     */
    private _helpers: Collection<GuildMemberId, Helper> = new Collection();
    /**
     * Server settings. An firebase update is requested as soon as this changes
     * - TODO: Use the Proxy class to abstract away the update logic
     */
    private settings: ServerSettings = {
        afterSessionMessage: '',
        autoGiveStudentRole: false,
        promptHelpTopic: true,
        hierarchyRoleIds: {
            /** role id of the bot admin role */
            botAdmin: SpecialRoleValues.NotSet,
            /** role id of the helper role */
            staff: SpecialRoleValues.NotSet,
            /** role id of the student role */
            student: SpecialRoleValues.NotSet
        }
    };

    protected constructor(
        readonly guild: Guild,
        readonly serverExtensions: ReadonlyArray<IServerExtension>
    ) {}

    /** List of queues on this server */
    get queues(): ReadonlyArray<HelpQueueV2> {
        return [...this._queues.values()];
    }
    /** All the students that are currently in a queue */
    get studentsInAllQueues(): ReadonlyArray<Helpee> {
        return this.queues.flatMap(queue => queue.students);
    }
    /** All the helpers on this server, both active and paused */
    get helpers(): ReadonlyMap<string, Helper> {
        return this._helpers;
    }
    /** Auto clear values of a queue, undefined if not set */
    get queueAutoClearTimeout(): Optional<AutoClearTimeout> {
        return this._queues.first()?.timeUntilAutoClear;
    }
    /** The after session message string. Empty string if not set */
    get afterSessionMessage(): string {
        return this.settings.afterSessionMessage;
    }
    /** The logging channel on this server. undefined if not set */
    get loggingChannel(): Optional<TextChannel> {
        return this.settings.loggingChannel;
    }
    /** bot admin role id */
    get botAdminRoleID(): OptionalRoleId {
        return this.settings.hierarchyRoleIds.botAdmin;
    }
    /** staff role id */
    get staffRoleID(): OptionalRoleId {
        return this.settings.hierarchyRoleIds.staff;
    }
    /** student role id, this is the everyone role if "@everyone is student" is selected */
    get studentRoleID(): OptionalRoleId {
        return this.settings.hierarchyRoleIds.student;
    }
    /** All the hierarchy role ids */
    get hierarchyRoleIds(): HierarchyRoles {
        return this.settings.hierarchyRoleIds;
    }
    /** whether to automatically give new members the student role */
    get autoGiveStudentRole(): boolean {
        return this.settings.autoGiveStudentRole;
    }
    /** whether to prompt modal asking for help topic when a user joins a queue */
    get promptHelpTopic(): boolean {
        return this.settings.promptHelpTopic;
    }
    /**
     * Returns an array of the roles for this server in the order [Bot Admin, Helper, Student]
     */
    get sortedHierarchyRoles(): ReadonlyArray<{
        key: keyof HierarchyRoles; // this can be used to index hierarchyRoleConfigs and HierarchyRoles
        displayName: typeof hierarchyRoleConfigs[keyof HierarchyRoles]['displayName'];
        id: OptionalRoleId;
    }> {
        return Object.entries(this.settings.hierarchyRoleIds).map(([name, id]) => ({
            key: name as keyof HierarchyRoles, // guaranteed to be the key
            displayName: hierarchyRoleConfigs[name as keyof HierarchyRoles].displayName,
            id: id
        }));
    }

    /**
     * Cleans up all the timers from setInterval
     */
    clearAllServerTimers(): void {
        this._queues.forEach(queue => queue.clearAllQueueTimers());
    }

    /**
     * Sends the log message to the logging channel if it's set up
     * @param message message to log
     */
    sendLogMessage(message: BaseMessageOptions | string): void {
        if (this.loggingChannel) {
            this.loggingChannel.send(message).catch(e => {
                console.error(red(`Failed to send logs to ${this.guild.name}.`));
                console.error(e);
            });
        }
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
     * Loads the server settings data from a backup
     * - queue backups are passed to the queue constructors
     * @param backup the data to load
     */
    private loadBackup(backup: ServerBackup): void {
        console.log(cyan(`Found external backup for ${this.guild.name}. Restoring.`));
        this.settings = {
            ...backup,
            hierarchyRoleIds: {
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
     * Sets the internal boolean value for promptHelpTopic
     * @param promptHelpTopic on or off
     */
    async setPromptHelpTopic(promptHelpTopic: boolean): Promise<void> {
        this.settings.promptHelpTopic = promptHelpTopic;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sets the hierarchy roles to use for this server
     * @param role name of the role; botAdmin, staff, or student
     * @param id the role id snowflake
     */
    async setHierarchyRoleId(role: keyof HierarchyRoles, id: Snowflake): Promise<void> {
        this.settings.hierarchyRoleIds[role] = id;
        await Promise.all([
            updateCommandHelpChannelVisibility(
                this.guild,
                this.settings.hierarchyRoleIds
            ),
            ...this.serverExtensions.map(extension =>
                extension.onServerRequestBackup(this)
            )
        ]);
    }

    /**
     * Sets the serious server flag, and updates the queues if seriousness is changed
     * @param enableSeriousMode turn on or off serious mode
     * @returns True if triggered renders for all queues
     */
    async setSeriousServer(enableSeriousMode: boolean): Promise<boolean> {
        const seriousState = this.queues[0]?.seriousModeEnabled ?? false;
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
     * Asynchronously creates a YABOB instance for 1 server
     * @param guild the server for YABOB to join
     * @returns a created instance of YABOB
     * @throws Uncaught Error if any setup functions fail
     */
    static async create(guild: Guild): Promise<AttendingServerV2> {
        await initializationCheck(guild);
        // Load ServerExtensions here
        const serverExtensions: IServerExtension[] = environment.disableExtensions
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
        const missingRoles = server.sortedHierarchyRoles.filter(
            role =>
                role.id === SpecialRoleValues.NotSet ||
                role.id === SpecialRoleValues.Deleted ||
                !guild.roles.cache.has(role.id)
        );
        if (missingRoles.length > 0) {
            const owner = await guild.fetchOwner();
            await owner.send(RolesConfigMenu(server, owner.id, true, '', true));
        }
        await Promise.all([
            server.initAllQueues(validBackup?.queues, validBackup?.hoursUntilAutoClear),
            server.createQueueRoles(),
            updateCommandHelpChannels(guild, server.hierarchyRoleIds)
        ]).catch(err => {
            console.error(err);
            throw new Error(`❗ ${red(`Initialization for ${guild.name} failed.`)}`);
        });
        await Promise.all(
            serverExtensions.map(extension => extension.onServerInitSuccess(server))
        );
        console.log(`⭐ ${green(`Initialization for ${guild.name} is successful!`)}`);
        return server;
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
        const vc = newVoiceState.channel;
        const memberIsStudent = this._helpers.some(helper =>
            helper.helpedMembers.some(
                helpedMember => helpedMember.member.id === member.id
            )
        );
        const memberIsHelper = this._helpers.has(member.id);
        if (memberIsStudent) {
            const possibleHelpers = newVoiceState.channel.members.filter(
                vcMember => vcMember.id !== member.id
            );
            const queuesToRerender = this._queues.filter(queue =>
                possibleHelpers.some(possibleHelper => queue.hasHelper(possibleHelper.id))
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
            const possibleHelpers = oldVoiceState.channel.members.filter(
                vcMember => vcMember.id !== member.id
            ); // treat everyone that's not this student as a potential helper
            const queuesToRerender = this.queues.filter(queue =>
                possibleHelpers.some(possibleHelper => queue.hasHelper(possibleHelper.id))
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
     * Creates a new office hour queue
     * @param newQueueName name for this queue
     * @throws ServerError if
     * - a queue with the same name already exists
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
     * @throws ServerError if
     * - a discord API failure happened
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
     * Attempt to enqueue a student
     * @param studentMember student member to enqueue
     * @param queueChannel target queue
     * @throws QueueError if queue refuses to enqueue
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
     * Notify all helpers in the queue that a student has joined
     * @param studentMember
     * @param queueChannel
     */
    async notifyHelpersStudentJoined(
        studentMember: GuildMember,
        queueChannel: QueueChannel
    ): Promise<void> {
        await this._queues
            .get(queueChannel.parentCategoryId)
            ?.notifyHelpersStudentQueued(studentMember);
    }

    /**
     * Notify all helpers of the topic that the student requires help with
     * @param studentMember
     * @param queueChannel
     * @param topic
     */
    async notifyHelpersStudentHelpTopic(
        studentMember: GuildMember,
        queueChannel: QueueChannel,
        topic: string
    ): Promise<void> {
        await this._queues
            .get(queueChannel.parentCategoryId)
            ?.notifyHelpersStudentHelpTopic(studentMember, topic);
    }

    /**
     * Dequeue the student that has been waiting for the longest globally
     * @param helperMember the helper that used /next.
     * @throws
     * - ServerError: if specificQueue is given but helper doesn't have the role
     * - QueueError: if the queue to dequeue from rejects
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
     * @param targetStudentMember if specified, remove this student and override queue order
     * @param targetQueue if specified, dequeue from this queue
     * - If both are specified, only look for the targetStudentMember in specificQueue
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
        const helper: Helper = {
            helpStart: new Date(),
            helpedMembers: [],
            activeState: 'active', // always start with active state
            member: helperMember
        };
        this._helpers.set(helperMember.id, helper);
        const helperRoles = helperMember.roles.cache.map(role => role.name);
        const openableQueues = this._queues.filter(queue =>
            helperRoles.includes(queue.queueName)
        );
        if (openableQueues.size === 0) {
            throw ExpectedServerErrors.missingClassRole;
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
     * @throws ServerError if the helper is not hosting
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
            ` - Help time of ${helper.member.displayName} is ` +
                `${convertMsToTime(
                    completeHelper.helpEnd.getTime() - completeHelper.helpStart.getTime()
                )}`
        );
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
     * Send an announcement to all the students in the helper's approved queues
     * @param helperMember helper that used /announce
     * @param announcement announcement message
     * @param targetQueue optional, specifies which queue to announce to
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
     * - let all the extensions clean up their own memory first before deleting them
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
        this.settings.loggingChannel = loggingChannel;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Creates all the command access hierarchy roles
     * @param allowDuplicate if true, creates new roles even if they already exist
     * - Duplicates will be created if roles with the same name already exist
     * @param everyoneIsStudent whether to treat @ everyone as the student role
     */
    async createHierarchyRoles(
        allowDuplicate: boolean,
        everyoneIsStudent: boolean
    ): Promise<void> {
        const allRoles = await this.guild.roles.fetch();
        const everyoneRoleId = this.guild.roles.everyone.id;
        const foundRoles = []; // sorted low to high
        const createdRoles = []; // not typed bc we are only using it for logging
        for (const role of this.sortedHierarchyRoles) {
            // do the search if it's NotSet, Deleted, or @everyone
            // so if existingRole is not undefined, it's one of @Bot Admin, @Staff or @Student
            const existingRole =
                (Object.values(SpecialRoleValues) as string[]).includes(role.id) ||
                role.id === everyoneRoleId
                    ? allRoles.find(serverRole => serverRole.name === role.displayName)
                    : allRoles.get(role.id);
            if (role.key === 'student' && everyoneIsStudent) {
                this.hierarchyRoleIds.student = everyoneRoleId;
                continue;
            }
            if (existingRole && !allowDuplicate) {
                this.hierarchyRoleIds[role.key] = existingRole.id;
                foundRoles[existingRole.position] = existingRole.name;
                continue;
            }
            const newRole = await this.guild.roles.create({
                ...hierarchyRoleConfigs[role.key],
                name: hierarchyRoleConfigs[role.key].displayName
            });
            this.hierarchyRoleIds[role.key] = newRole.id;
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
     * Checks the deleted `role` was a hierarchy role and if so, mark as deleted
     * @param deletedRole the role that was deleted
     */
    async onRoleDelete(deletedRole: Role): Promise<void> {
        let hierarchyRoleDeleted = false;
        // shorthand syntax to take the properties of an object with the same name
        for (const { key, id } of this.sortedHierarchyRoles) {
            if (deletedRole.id === id) {
                this.hierarchyRoleIds[key] = SpecialRoleValues.Deleted;
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
        // use a set to collect the unique queue names
        const existingRoles = new Set(this.guild.roles.cache.map(role => role.name));
        const queueNames = (await this.getQueueChannels(false)).map(
            channel => channel.queueName
        );
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
}

export { AttendingServerV2, QueueChannel };
