/** @module AttendingServerV2 */
import {
    CategoryChannel,
    Collection,
    Guild,
    GuildMember,
    BaseMessageOptions,
    TextChannel,
    User,
    VoiceChannel,
    VoiceState,
    ChannelType,
    VoiceBasedChannel
} from 'discord.js';
import { AutoClearTimeout, HelpQueueV2 } from '../help-queue/help-queue.js';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper.js';
import { commandChConfigs } from './command-ch-constants.js';
import { hierarchyRoleConfigs } from '../models/hierarchy-roles.js';
import { Helpee, Helper } from '../models/member-states.js';
import { IServerExtension } from '../extensions/extension-interface.js';
import { GoogleSheetLoggingExtension } from '../extensions/google-sheet-logging/google-sheet-logging.js';
import { FirebaseServerBackupExtension } from './firebase-backup.js';
import { CalendarExtensionState } from '../extensions/session-calendar/calendar-states.js';
import { QueueBackup } from '../models/backups.js';
import { blue, cyan, green, magenta, red, yellow } from '../utils/command-line-colors.js';
import { convertMsToTime } from '../utils/util-functions.js';
import {
    CategoryChannelId,
    GuildMemberId,
    HelpMessage,
    Optional,
    WithRequired
} from '../utils/type-aliases.js';
import { environment } from '../environment/environment-manager.js';
import { ExpectedServerErrors } from './expected-server-errors.js';

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
    /** enables helper vc status in queue embeds */
    private readonly useExperimentalVCStatusRerender = true;

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
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this)),
            this._queues.map(queue => queue.setSeriousMode(enableSeriousMode))
        ]);
        return true;
    }

    /**
     * Cleans up all the timers from setInterval
     */
    clearAllServerTimers(): void {
        this._queues.forEach(queue => queue.clearAllQueueTimers());
    }

    /**
     * Asynchronously creates a YABOB instance for 1 server
     * @param user discord client user
     * @param guild the server for YABOB to join
     * @returns a created instance of YABOB
     * @throws ServerError
     */
    static async create(user: User, guild: Guild): Promise<AttendingServerV2> {
        if (
            guild.members.me === null ||
            !guild.members.me.permissions.has('Administrator')
        ) {
            const owner = await guild.fetchOwner();
            await owner.send(
                SimpleEmbed(
                    `Sorry, I need full administrator permission for '${guild.name}'`,
                    EmbedColor.Error
                )
            );
            await guild.leave();
            throw Error("YABOB doesn't have admin permission.");
        }
        if (guild.members.me.roles.highest.comparePositionTo(guild.roles.highest) < 0) {
            const owner = await guild.fetchOwner();
            await owner.send(
                SimpleEmbed(
                    `It seems like I'm joining a server with existing roles. ` +
                        `Please go to server settings -> Roles and change ${user.username} ` +
                        `to the highest role.\n`,
                    EmbedColor.Error
                )
            );
            throw Error("YABOB doesn't have highest role.");
        }
        // Load ServerExtensions here
        const serverExtensions: IServerExtension[] = environment.disableExtensions
            ? []
            : await Promise.all([
                  GoogleSheetLoggingExtension.load(guild),
                  new FirebaseServerBackupExtension(guild),
                  CalendarExtensionState.load(guild)
              ]);
        // Retrieve backup from all sources. Take the first one that's not undefined
        // TODO: Change behavior here depending on backup strategy
        const externalBackup = environment.disableExtensions
            ? undefined
            : await Promise.all(
                  serverExtensions.map(extension =>
                      extension.loadExternalServerData(guild.id)
                  )
              );
        const externalServerData = externalBackup?.find(backup => backup !== undefined);
        if (externalServerData !== undefined) {
            console.log(cyan(`Found external backup for ${guild.name}. Restoring.`));
        }
        const server = new AttendingServerV2(user, guild, serverExtensions);
        server._afterSessionMessage = externalServerData?.afterSessionMessage ?? '';
        if (externalServerData?.loggingChannelId !== undefined) {
            server._loggingChannel = server.guild.channels.cache.get(
                externalServerData?.loggingChannelId
            ) as TextChannel;
        }
        // This call must block everything else for handling empty servers
        await server.createHierarchyRoles();
        // The ones below can be launched together. After this Promise the server is ready
        await Promise.all([
            server.initAllQueues(
                externalServerData?.queues,
                externalServerData?.hoursUntilAutoClear
            ),
            server.createClassRoles(),
            server.updateCommandHelpChannels()
        ]).catch(err => {
            console.error(err);
            throw new Error(`❗ ${red(`Initilization for ${guild.name} failed.`)}`);
        });
        // Now Emit all the events
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
                    extension.onStudentJoinVC(
                        this,
                        member,
                        // already checked
                        newVoiceState.channel as VoiceChannel
                    )
                ),
                ...(this.useExperimentalVCStatusRerender &&
                    queuesToRerender.map(queue => queue.triggerRender()))
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
                ...(this.useExperimentalVCStatusRerender &&
                    queuesToRerender.map(queue => queue.triggerRender()))
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
        // cache again on a fresh request
        this.queueChannelsCache = allChannels
            .filter(ch => ch !== null && ch.type === ChannelType.GuildCategory)
            // ch has type 'AnyChannel', have to cast, type already checked
            .map(channel => channel as CategoryChannel)
            .map(category => [
                category.children.cache.find(
                    child =>
                        child.name === 'queue' && child.type === ChannelType.GuildText
                ),
                category.name,
                category.id
            ])
            .filter(([textChannel]) => textChannel !== undefined)
            .map(([ch, name, parentId]) => {
                return {
                    channelObj: ch,
                    queueName: name,
                    parentCategoryId: parentId
                } as QueueChannel;
            });
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
            HelpQueueV2.create(queueChannel, this.user, this.guild.roles.everyone),
            this.createClassRoles()
        ]);
        this._queues.set(parentCategory.id, helpQueue);
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
        const parentCategory = (await (await this.guild.channels.fetch())
            .find(ch => ch !== null && ch.id === queueCategoryID)
            ?.fetch()) as CategoryChannel;
        // delete child channels first
        await Promise.all(
            parentCategory?.children.cache
                .map(child => child.delete())
                .filter(promise => promise !== undefined)
        );
        // now delete category, role, and let queue call onQueueDelete
        await Promise.all([
            parentCategory?.delete(),
            (await this.guild.roles.fetch())
                .find(role => role.name === parentCategory.name)
                ?.delete(),
            queue.gracefulDelete()
        ]);
        // finally delete queue data model and refresh cache
        this._queues.delete(queueCategoryID);
        await this.getQueueChannels(false);
    }

    /**
     * Attempt to enqueue a student
     * @param studentMember student member to enqueue
     * @param queue target queue
     * @throws QueueError: if @param queue rejects
     */
    async enqueueStudent(studentMember: GuildMember, queue: QueueChannel): Promise<void> {
        await this._queues.get(queue.parentCategoryId)?.enqueue(studentMember);
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
                prev.first && // use truthyness/falsyness
                curr.first && // both null & undefined evaluates to false
                prev.first.waitStart.getTime() < curr.first.waitStart.getTime()
                    ? prev // if the first 2 conditions passed,
                    : curr //  both prev.first and curr.first will not be undefined
        );
        const student = await queueToDequeue.dequeueWithHelper(helperMember);
        await this.sendInvite(helperObject, student, helperVoiceChannel);
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
        await this.sendInvite(helperObject, student, helperVoiceChannel);
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
                        role.name === targetQueue.queueName || role.name === 'Bot Admin'
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
            .map(queueToAnnounce => queueToAnnounce.students)
            .flat();
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
        // trigger anything listening to internal updates
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
     * Updates the help channel messages
     * Removes all messages in the help channel and posts new ones
     */
    async updateCommandHelpChannels(): Promise<void> {
        const allChannels = await this.guild.channels.fetch();
        const existingHelpCategory = allChannels
            .filter(
                channel =>
                    channel !== null &&
                    channel.type === ChannelType.GuildCategory &&
                    channel.name === 'Bot Commands Help'
            )
            .map(channel => channel as CategoryChannel);
        // If no help category is found, initialize
        if (existingHelpCategory.length === 0) {
            console.log(
                cyan(`Found no help channels in ${this.guild.name}. Creating new ones.`)
            );
            const helpCategory = await this.guild.channels.create({
                name: 'Bot Commands Help',
                type: ChannelType.GuildCategory
            });
            existingHelpCategory.push(helpCategory);
            // Change the config object and add more functions here if needed
            await Promise.all(
                commandChConfigs.map(async roleConfig => {
                    const commandCh = await helpCategory.children.create({
                        name: roleConfig.channelName
                    });
                    await commandCh.permissionOverwrites.create(
                        this.guild.roles.everyone,
                        {
                            SendMessages: false,
                            ViewChannel: false
                        }
                    );
                    await Promise.all(
                        this.guild.roles.cache
                            .filter(role => roleConfig.visibility.includes(role.name))
                            .map(roleWithViewPermission =>
                                commandCh.permissionOverwrites.create(
                                    roleWithViewPermission,
                                    {
                                        ViewChannel: true
                                    }
                                )
                            )
                    );
                })
            );
        } else {
            console.log(
                yellow(
                    `Found existing help channels in ${this.guild.name}, updating command help files`
                )
            );
        }
        await this.sendCommandHelpChannelMessages(existingHelpCategory, commandChConfigs);
        console.log(magenta(`✓ Updated help channels on ${this.guild.name} ✓`));
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
     * Sends `message` to the logging channel, if logging is enabled
     * @param message
     */
    async sendLogMessage(message: BaseMessageOptions | string): Promise<void> {
        if (this._loggingChannel) {
            await this._loggingChannel.send(message);
        }
    }

    async createOffices(
        categoryName: string,
        officeName: string,
        numberOfOffices: number
    ): Promise<void> {
        const allChannels = await this.guild.channels.fetch();
        // Find if a category with the same name exists
        const existingOfficeCategory = allChannels
            .filter(
                channel =>
                    channel !== null &&
                    channel.type === ChannelType.GuildCategory &&
                    channel.name === categoryName
            )
            .map(channel => channel as CategoryChannel);

        // If no help category is found, initialize
        if (existingOfficeCategory.length === 0) {
            console.log(
                cyan(`Found no office channels in ${this.guild.name}. Creating new ones.`)
            );
            const officeCategory = await this.guild.channels.create({
                name: categoryName,
                type: ChannelType.GuildCategory
            });
            // Change the config object and add more functions here if needed
            await Promise.all(
                // I have no clue why the next line works like a promise for loop
                [...Array(numberOfOffices).keys()].map(async officeNumber => {
                    const officeCh = await officeCategory.children.create({
                        name: `${officeName} ${officeNumber + 1}`,
                        type: ChannelType.GuildVoice
                    });
                    await officeCh.permissionOverwrites.create(
                        this.guild.roles.everyone,
                        {
                            SendMessages: false,
                            ViewChannel: false
                        }
                    );
                    await Promise.all(
                        this.guild.roles.cache
                            .filter(role => role.name === 'Staff')
                            .map(roleWithViewPermission =>
                                officeCh.permissionOverwrites.create(
                                    roleWithViewPermission,
                                    {
                                        ViewChannel: true
                                    }
                                )
                            )
                    );
                })
            );
        } else {
            throw ExpectedServerErrors.categoryAlreadyExists(categoryName);
        }
    }

    /**
     * Sends the VC invite to the student after successful dequeue
     * @param helperObject
     * @param student
     * @param helperVoiceChannel
     */
    private async sendInvite(
        helperObject: Helper,
        student: Readonly<Helpee>,
        helperVoiceChannel: VoiceBasedChannel
    ) {
        helperObject.helpedMembers.push(student);
        const [invite] = await Promise.all([
            helperVoiceChannel.createInvite({
                maxAge: 15 * 60,
                maxUses: 1
            }),
            helperVoiceChannel.permissionOverwrites.create(student.member, {
                ViewChannel: true,
                Connect: true
            })
        ]);
        await Promise.all([
            ...this.serverExtensions.map(extension =>
                extension.onDequeueFirst(this, student)
            ),
            ...this.serverExtensions.map(extension =>
                extension.onServerRequestBackup(this)
            ),
            student.member.send(
                SimpleEmbed(
                    `It's your turn! Join the call: ${invite.toString()}`,
                    EmbedColor.Success
                )
            )
        ]);
        // remove the overwrite when the link dies
        setTimeout(() => {
            helperVoiceChannel.permissionOverwrites.cache
                .find(overwrite => overwrite.id === student.member.id)
                ?.delete()
                .catch(() =>
                    console.error(
                        `Failed to delete overwrite for ${student.member.displayName}`
                    )
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
        if (this._queues.size !== 0) {
            console.warn('Overriding existing queues.');
        }
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
                        this.user,
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
                extension.onAllQueuesInit(this, [...this._queues.values()])
            )
        );
    }

    /**
     * Creates all the command access hierarchy roles
     */
    private async createHierarchyRoles(): Promise<void> {
        const existingRoles = (await this.guild.roles.fetch())
            .filter(role => role.name !== this.user.username && role.name !== '@everyone')
            .map(role => role.name);
        const createdRoles = await Promise.all(
            hierarchyRoleConfigs
                .filter(role => !existingRoles.includes(role.name))
                .map(roleConfig => this.guild.roles.create(roleConfig))
        );
        if (createdRoles.length !== 0) {
            console.log('Created roles:');
            console.log(
                createdRoles
                    .map(r => {
                        return { name: r.name, pos: r.position };
                    })
                    .sort((a, b) => a.pos - b.pos)
            );
        } else {
            console.log(`All required roles exist in ${this.guild.name}!`);
        }
        // Give everyone the student role
        const studentRole = this.guild.roles.cache.find(role => role.name === 'Student');
        await Promise.all(
            this.guild.members.cache.map(async member => {
                if (
                    member.user.id !== this.user.id &&
                    studentRole &&
                    !member.roles.cache.has(studentRole.id) &&
                    !member.user.bot
                ) {
                    await member.roles.add(studentRole);
                }
            })
        );
    }

    /**
     * Creates roles for all the available queues if not already created
     */
    private async createClassRoles(): Promise<void> {
        const existingRoles = new Set(this.guild.roles.cache.map(role => role.name));
        const queueNames = (await this.getQueueChannels(false)).map(ch => ch.queueName);
        await Promise.all(
            queueNames
                .filter(queue => !existingRoles.has(queue))
                .map(roleToCreate =>
                    this.guild.roles.create({
                        name: roleToCreate,
                        position: 1
                    })
                )
        );
    }

    /**
     * Overwrites the existing command help channel and send new help messages
     * @param helpCategories the category named 'Bot Commands Help'
     * @param messageContents array of embeds to send to each help channel
     */
    private async sendCommandHelpChannelMessages(
        helpCategories: CategoryChannel[],
        messageContents: Array<{
            channelName: string;
            file: HelpMessage[];
            visibility: string[];
        }>
    ): Promise<void> {
        const allHelpChannels = helpCategories.flatMap(
            category =>
                [...category.children.cache.values()].filter(
                    ch => ch.type === ChannelType.GuildText
                ) as TextChannel[]
        );
        await Promise.all(
            allHelpChannels.map(
                async ch =>
                    await ch.messages
                        .fetch()
                        .then(messages => messages.map(msg => msg.delete()))
            )
        );
        // send new ones
        await Promise.all(
            allHelpChannels.map(channel =>
                messageContents
                    .find(val => val.channelName === channel.name)
                    ?.file?.filter(helpMessage => helpMessage.useInHelpChannel)
                    .map(helpMessage => channel.send(helpMessage.message))
            )
        );
    }
}

export { AttendingServerV2, QueueChannel };
