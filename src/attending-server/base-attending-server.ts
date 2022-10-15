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
    OverwriteType
} from 'discord.js';
import { AutoClearTimeout, HelpQueueV2 } from '../help-queue/help-queue';
import { EmbedColor, SimpleEmbed } from '../utils/embed-helper';
import { commandChConfigs } from './command-ch-constants';
import { hierarchyRoleConfigs } from '../models/hierarchy-roles';
import { PeriodicUpdateError, ServerError } from '../utils/error-types';
import { Helpee, Helper } from '../models/member-states';
import { IServerExtension } from '../extensions/extension-interface';
import { GoogleSheetLoggingExtension } from '../extensions/google-sheet-logging/google-sheet-logging';
import { FirebaseServerBackupExtension } from '../extensions/firebase-backup/firebase-extension';
import { CalendarServerEventListener } from '../extensions/session-calendar/calendar-states';
import { QueueBackup } from '../models/backups';
import {
    FgBlue,
    FgCyan,
    FgGreen,
    FgMagenta,
    FgRed,
    FgYellow,
    ResetColor
} from '../utils/command-line-colors';
import { convertMsToTime } from '../utils/util-functions';
import {
    CategoryChannelId,
    GuildMemberId,
    HelpMessage,
    Optional,
    WithRequired
} from '../utils/type-aliases';
import environment from '../environment/environment-manager';

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
 * Used as map keys to keep track of the timers we spin up
 * prevents unused timers from staying in the js event queue
 * - Union with more string literals if needed
 */
type ServerTimerType = 'SERVER_PERIODIC_UPDATE';

/**
 * V2 of AttendingServer. Represents 1 server that this YABOB is a member of
 * ----
 * public functions can be accessed by the command handler
 * private functions are designed to not be triggered by commands
 * variables with an underscore has a public getter, but only mutable inside the class
 */
class AttendingServerV2 {
    // Keeps track of all the setTimout/setIntervals we started
    timers: Collection<ServerTimerType, NodeJS.Timeout | NodeJS.Timer> = new Collection();
    // message sent to students after they leave
    afterSessionMessage = '';
    // optional, channel where yabob will log message. if undefined, don't log on the server
    loggingChannel?: TextChannel;
    // Key is CategoryChannel.id of the parent catgory of #queue
    private _queues: Collection<CategoryChannelId, HelpQueueV2> = new Collection();
    // cached result of getQueueChannels
    private queueChannelsCache: QueueChannel[] = [];
    // unique active helpers, key is member.id
    private _activeHelpers: Collection<GuildMemberId, Helper> = new Collection();

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

    /**
     * Cleans up all the timers from setInterval
     */
    clearAllServerTimers(): void {
        this.timers.forEach(clearInterval);
        this.timers.clear();
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
                  GoogleSheetLoggingExtension.load(guild.name),
                  FirebaseServerBackupExtension.load(guild.name, guild.id),
                  new CalendarServerEventListener()
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
            console.log(
                `${FgCyan}Found external backup for ${guild.name}.` +
                    ` Restoring.${ResetColor}`
            );
        }
        const server = new AttendingServerV2(user, guild, serverExtensions);
        server.afterSessionMessage = externalServerData?.afterSessionMessage ?? '';
        if (externalServerData?.loggingChannelId !== undefined) {
            server.loggingChannel = server.guild.channels.cache.get(
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
            throw new ServerError(
                `❗ ${FgRed}Initilization for ${guild.name} failed.${ResetColor}`
            );
        });
        // Now Emit all the events
        await Promise.all(
            serverExtensions
                .map(extension => [
                    extension.onServerInitSuccess(server),
                    extension.onServerPeriodicUpdate(server, true)
                ])
                .flat()
        );
        // Call onServerPeriodicUpdate every 15min +- 1min
        server.timers.set(
            'SERVER_PERIODIC_UPDATE',
            setInterval(
                async () =>
                    await Promise.all(
                        serverExtensions.map(extension =>
                            extension.onServerPeriodicUpdate(server, false)
                        )
                    ).catch((err: Error) =>
                        console.error(
                            new PeriodicUpdateError(
                                `${err.name}: ${err.message}`,
                                'Server'
                            )
                        )
                    ),
                1000 * 60 * 15 + Math.floor(Math.random() * 1000 * 60)
            )
        );
        console.log(
            `⭐ ${FgGreen}Initilization for ${guild.name} is successful!${ResetColor}`
        );
        return server;
    }

    async onMemberJoinVC(
        member: GuildMember,
        newVoiceState: WithRequired<VoiceState, 'channel'>
    ): Promise<void> {
        const memberIsStudent = this._activeHelpers.some(helper =>
            helper.helpedMembers.some(
                helpedMember => helpedMember.member.id === member.id
            )
        );
        if (!memberIsStudent || newVoiceState.channel === null) {
            return;
        }
        await Promise.all(
            this.serverExtensions.map(extension =>
                extension.onStudentJoinVC(
                    this,
                    member,
                    // already checked
                    newVoiceState.channel as VoiceChannel
                )
            )
        );
    }

    async onMemberLeaveVC(
        member: GuildMember,
        oldVoiceState: WithRequired<VoiceState, 'channel'>
    ): Promise<void> {
        const memberIsStudent = this._activeHelpers.some(helper =>
            helper.helpedMembers.some(
                helpedMember => helpedMember.member.id === member.id
            )
        );
        if (!memberIsStudent) {
            return;
        }
        await Promise.all<unknown>([
            ...oldVoiceState.channel.permissionOverwrites.cache.map(
                overwrite => overwrite.type === OverwriteType.Member && overwrite.delete()
            ),
            ...this.serverExtensions.map(extension =>
                extension.onStudentLeaveVC(this, member)
            ),
            this.afterSessionMessage !== '' &&
                member.send(SimpleEmbed(this.afterSessionMessage))
        ]);
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
            .map(category => [
                (category as CategoryChannel).children.cache.find(
                    child =>
                        child.name === 'queue' && child.type === ChannelType.GuildText
                ),
                (category as CategoryChannel).name,
                (category as CategoryChannel).id
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
            throw new ServerError(`Queue ${newQueueName} already exists`);
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
            throw new ServerError('This queue does not exist.');
        }
        const parentCategory = (await (await this.guild.channels.fetch())
            .find(ch => ch !== null && ch.id === queueCategoryID)
            ?.fetch()) as CategoryChannel;
        // delete child channels first
        await Promise.all(
            parentCategory?.children.cache
                .map(child => child.delete())
                .filter(promise => promise !== undefined) as Promise<TextChannel>[]
        ).catch((err: Error) => {
            throw new ServerError(`API Failure: ${err.name}\n${err.message}`);
        });
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
        const currentlyHelpingQueues = this._queues.filter(queue =>
            queue.activeHelperIds.has(helperMember.id)
        );
        if (currentlyHelpingQueues.size === 0) {
            throw new ServerError('You are not currently hosting.');
        }
        const helperVoiceChannel = helperMember.voice.channel;
        if (helperVoiceChannel === null) {
            throw new ServerError(`You need to be in a voice channel first.`);
        }
        const nonEmptyQueues = currentlyHelpingQueues.filter(
            queue => queue.isOpen && queue.length !== 0
        );
        // check must happen before reduce, reduce on empty arrays will throw an error
        if (nonEmptyQueues.size === 0) {
            throw new ServerError(
                `There's no one left to help. You should get some coffee!`
            );
        }
        const queueToDequeue = nonEmptyQueues.reduce<HelpQueueV2>((prev, curr) =>
            prev.first?.waitStart !== undefined &&
            curr.first?.waitStart !== undefined &&
            prev.first?.waitStart.getTime() < curr.first?.waitStart.getTime()
                ? prev
                : curr
        );
        const student = await queueToDequeue.dequeueWithHelper(helperMember);
        this._activeHelpers.get(helperMember.id)?.helpedMembers.push(student);
        // this api call is slow
        await Promise.all([
            helperVoiceChannel.permissionOverwrites.cache.map(
                overwrite => overwrite.type === OverwriteType.Member && overwrite.delete()
            )
        ]);
        await helperVoiceChannel.permissionOverwrites.create(student.member, {
            ViewChannel: true,
            Connect: true
        });
        const invite = await helperVoiceChannel.createInvite({
            maxAge: 15 * 60, // 15 minutes
            maxUses: 1
        });
        await Promise.all<unknown>([
            ...this.serverExtensions.map(extension =>
                extension.onDequeueFirst(this, student)
            ),
            student.member.send(
                SimpleEmbed(
                    `It's your turn! Join the call: ${invite.toString()}`,
                    EmbedColor.Success
                )
            )
        ]);
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
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
        const currentlyHelpingQueues = this._queues.filter(queue =>
            queue.activeHelperIds.has(helperMember.id)
        );
        if (currentlyHelpingQueues.size === 0) {
            throw new ServerError('You are not currently hosting.');
        }
        const helperVoiceChannel = helperMember.voice.channel;
        if (helperVoiceChannel === null) {
            throw new ServerError(`You need to be in a voice channel first.`);
        }
        let student: Optional<Readonly<Helpee>>;
        if (specificQueue !== undefined) {
            // if queue is specified, find the queue and let queue dequeue
            if (
                !helperMember.roles.cache.some(
                    role => role.name === specificQueue.queueName
                )
            ) {
                throw new ServerError(
                    `You don't have the permission to dequeue ` +
                        `\`${specificQueue.queueName}\`.`
                );
            }
            student = await this._queues
                .get(specificQueue.parentCategoryId)
                ?.dequeueWithHelper(helperMember, targetStudentMember);
        } else if (targetStudentMember !== undefined) {
            const queue = this._queues.find(queue =>
                queue.students.some(
                    student => student.member.id === targetStudentMember.id
                )
            );
            student = await queue?.removeStudent(targetStudentMember);
            if (student === undefined) {
                throw new ServerError(
                    `The student ${targetStudentMember.displayName} is not in any of the queues.`
                );
            }
        }
        if (student === undefined) {
            // won't be seen, only the above error messages will be sent
            // this is just here for semantics
            throw new ServerError('Dequeue with the given arguments failed.');
        }
        this._activeHelpers.get(helperMember.id)?.helpedMembers.push(student);
        // this api call is slow
        await Promise.all([
            helperVoiceChannel.permissionOverwrites.cache.map(
                overwrite => overwrite.type === OverwriteType.Member && overwrite.delete()
            )
        ]);
        await helperVoiceChannel.permissionOverwrites.create(student.member, {
            ViewChannel: true,
            Connect: true
        });
        const invite = await helperVoiceChannel.createInvite({
            maxAge: 15 * 60, // 15 minutes
            maxUses: 1
        });
        await Promise.all<unknown>([
            ...this.serverExtensions.map(
                // ts doesn't recognize the undefined check for some reason
                extension => extension.onDequeueFirst(this, student as Readonly<Helpee>)
            ),
            student.member.send(
                SimpleEmbed(
                    `It's your turn! Join the call: ${invite.toString()}`,
                    EmbedColor.Success
                )
            )
        ]);
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
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
            throw new ServerError('You are already hosting.');
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
            throw new ServerError(
                `It seems like you don't have any class roles.\n` +
                    `This might be a human error. ` +
                    `In the meantime, you can help students through DMs.`
            );
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
            throw new ServerError('You are not currently hosting.');
        }
        helper.helpEnd = new Date();
        this._activeHelpers.delete(helperMember.id);
        console.log(
            ` - Help time of ${helper.member.displayName} is ` +
                `${convertMsToTime(
                    helper.helpEnd.getTime() - helper.helpStart.getTime()
                )}`
        );
        const closableQueues = this._queues.filter(queue =>
            helperMember.roles.cache.map(role => role.name).includes(queue.queueName)
        );
        await Promise.all(closableQueues.map(queue => queue.closeQueue(helperMember)));
        await Promise.all(
            this.serverExtensions.map(extension =>
                extension.onHelperStopHelping(this, helper as Required<Helper>)
            )
        );
        return helper as Required<Helper>;
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
     * Separated from clear queue to avoid excessive backup calls
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
     * @param message announcement body
     * @param targetQueue optional, specifies which queue to announce to
     */
    async announceToStudentsInQueue(
        helperMember: GuildMember,
        message: string,
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
                throw new ServerError(
                    `You don't have permission to announce in ${targetQueue.queueName}. ` +
                        `You can only announce to queues that you have a role of.`
                );
            }
            await Promise.all(
                queueToAnnounce.students.map(student =>
                    student.member.send(
                        SimpleEmbed(
                            `Staff member ${helperMember.displayName} announced:\n${message}`,
                            EmbedColor.Aqua,
                            `In queue: ${targetQueue.queueName}`
                        )
                    )
                )
            );
            return;
        }
        // from this.queues select queue where helper roles has queue name
        await Promise.all(
            this._queues
                .filter(queue =>
                    helperMember.roles.cache.some(role => role.name === queue.queueName)
                )
                .map(queueToAnnounce => queueToAnnounce.students)
                .flat()
                .map(student =>
                    student.member.send(
                        SimpleEmbed(
                            `Staff member ${helperMember.displayName} announced:\n${message}`,
                            EmbedColor.Aqua
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
        await this._queues.get(targetQueue.parentCategoryId)?.triggerRender();
    }

    /**
     * Sets the after sesseion message for this server
     * @param newMessage after session message to set
     * - Side Effect: Triggers a firebase backup
     */
    async setAfterSessionMessage(newMessage: string): Promise<void> {
        this.afterSessionMessage = newMessage;
        // trigger anything listening to internal updates
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    /**
     * Sets up queue auto clear for this server
     * @param hours the number of hours to wait before clearing the queue
     * @param enable whether to disable auto clear, overrides 'hours'
     */
    async setQueueAutoClear(hours: number, enable: boolean): Promise<void> {
        this._queues.forEach(queue => queue.setAutoClear(hours, enable));
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
                `${FgCyan}Found no help channels in ${this.guild.name}. ` +
                    `Creating new ones.${ResetColor}`
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
                `${FgYellow}Found existing help channels in ${this.guild.name}, ` +
                    `updating command help files${ResetColor}.`
            );
        }
        await this.sendCommandHelpChannelMessages(existingHelpCategory, commandChConfigs);
        console.log(
            `${FgMagenta}✓ Updated help channels on ${this.guild.name} ✓${ResetColor}`
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
        this.loggingChannel = loggingChannel;
        await Promise.all(
            this.serverExtensions.map(extension => extension.onServerRequestBackup(this))
        );
    }

    async sendLogMessage(message: BaseMessageOptions | string): Promise<void> {
        this.loggingChannel && (await this.loggingChannel.send(message));
    }

    /**
     * Creates all the office hour queues
     * @param queueBackups
     * - if a backup extension is enabled, this is the queue data to load
     */
    private async initAllQueues(
        queueBackups?: QueueBackup[],
        hoursUntilAutoClear: AutoClearTimeout = 'AUTO_CLEAR_DISABLED'
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
                          hoursUntilAutoClear: hoursUntilAutoClear
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
                `${
                    environment.disableExtensions
                        ? ''
                        : ` ${FgBlue}with their extensions${ResetColor}`
                }!`
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
            file: Array<HelpMessage>;
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
