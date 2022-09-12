import {
    CategoryChannel, Collection, Guild,
    GuildMember, MessageOptions, TextChannel,
    User, VoiceChannel, VoiceState,
} from "discord.js";
import { HelpQueueV2 } from "../help-queue/help-queue";
import { EmbedColor, SimpleEmbed } from "../utils/embed-helper";
import { commandChConfigs } from "./command-ch-constants";
import { hierarchyRoleConfigs } from "../models/hierarchy-roles";
import { ServerError } from "../utils/error-types";
import { Helpee, Helper } from "../models/member-states";

import { IServerExtension } from "../extensions/extension-interface";
import { GoogleSheetLoggingExtension } from "../extensions/google-sheet-logging/google-sheet-logging";
import { FirebaseServerBackupExtension } from '../extensions/firebase-backup/firebase-extension';
import { QueueBackup } from "../extensions/firebase-backup/firebase-models/backups";
import {
    FgBlue, FgCyan, FgGreen,
    FgMagenta, FgRed, FgYellow, ResetColor
} from "../utils/command-line-colors";
import { msToHourMins } from "../utils/util-functions";


// Wrapper for TextChannel
// Guarantees that a queueName and parentCategoryId exists
type QueueChannel = {
    channelObj: TextChannel;
    queueName: string;
    parentCategoryId: string;
};

/**
 * V2 of AttendingServer. Represents 1 server that this YABOB is a member of
 * ----
 * public functions can be accessed by the command handler
 * private functions are designed to not be triggered by commands
*/
class AttendingServerV2 {

    // late init, used for clearAllIntervals only
    intervalID!: NodeJS.Timer;
    // message sent to students after they leave 
    afterSessionMessage = "";
    // Key is CategoryChannel.id of the parent catgory of #queue
    private queues: Collection<string, HelpQueueV2> = new Collection();
    // cached result of getQueueChannels
    private queueChannelsCache: QueueChannel[] = [];
    // unique active helpers, key is member.id
    private activeHelpers: Collection<string, Helper> = new Collection();

    protected constructor(
        readonly user: User,
        readonly guild: Guild,
        private readonly serverExtensions: IServerExtension[],
    ) { }

    get helpQueues(): ReadonlyArray<HelpQueueV2> {
        return [...this.queues.values()];
    }
    get studentsInAllQueues(): ReadonlyArray<Helpee> {
        return this.queues.map(queue => queue.studentsInQueue).flat();
    }
    get helpers(): Readonly<Collection<string, Helper>> {
        return this.activeHelpers;
    }

    /**
     * Cleans up all the timers from setInterval
     * ----
    */
    clearAllIntervals(): void {
        clearInterval(this.intervalID);
        this.queues.forEach(queue => clearInterval(queue.intervalID));
    }

    /**
     * Asynchronously creates a YABOB instance for 1 server
     * ----
     * @param user discord client user
     * @param guild the server for YABOB to join
     * @returns a created instance of YABOB
     * @throws ServerError
     */
    static async create(user: User, guild: Guild): Promise<AttendingServerV2> {
        if (guild.me === null ||
            !guild.me.permissions.has("ADMINISTRATOR")
        ) {
            const owner = await guild.fetchOwner();
            await owner.send(
                SimpleEmbed(
                    `Sorry, I need full administrator permission for "${guild.name}"`,
                    EmbedColor.Error));
            await guild.leave();
            return Promise.reject(Error("YABOB doesn't have admin permission."));
        }
        if (guild.me.roles.highest.comparePositionTo(guild.roles.highest) < 0) {
            const owner = await guild.fetchOwner();
            await owner.send(
                SimpleEmbed(
                    `It seems like I'm joining a server with existing roles. ` +
                    `Please go to server settings -> Roles and change ${user.username} ` +
                    `to the highest role.\n`,
                    EmbedColor.Error));
            return Promise.reject(Error("YABOB doesn't have highest role."));
        }
        // Load ServerExtensions here
        const disableExtensions = process.argv.slice(2)[0]?.split('=')[1] === 'true';
        const serverExtensions = disableExtensions
            ? []
            : await Promise.all([
                GoogleSheetLoggingExtension.load(guild.name),
                FirebaseServerBackupExtension.load(guild.name, guild.id)
            ]);
        // Retrieve backup from all sources. Take the first one that's not undefined 
        // Change behavior here depending on backup strategy
        const externalBackup = disableExtensions
            ? undefined
            : await Promise.all(
                serverExtensions.map(extension => extension.loadExternalServerData(guild.id))
            );
        const externalServerData = externalBackup?.find(backup => backup !== undefined);
        if (externalServerData !== undefined) {
            console.log(
                `${FgCyan}Found external backup for ${guild.name}.` +
                ` Restoring...${ResetColor}`
            );
        }
        const server = new AttendingServerV2(
            user,
            guild,
            serverExtensions
        );
        server.afterSessionMessage = externalServerData?.afterSessionMessage ?? "";
        // This call must block everything else for handling empty servers
        await server.createHierarchyRoles();
        // The ones below can be launched together. After this Promise the server is ready
        await Promise.all([
            server.initAllQueues(externalServerData?.queues),
            server.createClassRoles(),
            server.updateCommandHelpChannels()
        ]).catch(err => {
            console.error(err);
            throw new ServerError(
                `❗ ${FgRed}Initilization for ${guild.name} failed.${ResetColor}`
            );
        });
        // Now Emit all the events
        await Promise.all(serverExtensions.map(
            extension => [
                extension.onServerInitSuccess(server),
                extension.onServerPeriodicUpdate(server, true)
            ]).flat());
        // Call onServerPeriodicUpdate every 30min +- 1 second
        server.intervalID = setInterval(async () =>
            await Promise.all(serverExtensions
                .map(extension => extension.onServerPeriodicUpdate(server)))
            , 1000 * 60 * 30 + Math.floor(Math.random() * 1000));

        console.log(
            `⭐ ${FgGreen}Initilization for ${guild.name} is successful!${ResetColor}`
        );
        return server;
    }

    async onMemberJoinVC(
        member: GuildMember,
        newVoiceState: VoiceState
    ): Promise<void> {
        const memberIsStudent = this.activeHelpers
            .some(helper => helper.helpedMembers
                .some(helpedMember => helpedMember.member.id === member.id));
        if (!memberIsStudent || newVoiceState.channel === null) {
            return;
        }
        await Promise.all(this.serverExtensions.map(
            extension => extension.onStudentJoinVC(
                this,
                member,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                newVoiceState.channel! as VoiceChannel
            )));
    }

    async onMemberLeaveVC(
        member: GuildMember
    ): Promise<void> {
        const memberIsStudent = this.activeHelpers
            .some(helper => helper.helpedMembers
                .some(helpedMember => helpedMember.member.id === member.id));
        if (!memberIsStudent) {
            return;
        }
        await Promise.all([
            this.serverExtensions.map(extension =>
                extension.onStudentLeaveVC(this, member)
            ),
            this.afterSessionMessage !== '' && member.send(SimpleEmbed(this.afterSessionMessage))
        ].flat() as Promise<void>[]);
    }

    /**
     * Gets all the queue channels on the server. SLOW
     * ----
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
            .filter(ch => ch.type === "GUILD_CATEGORY")
            // ch has type 'AnyChannel', have to cast, type already checked
            .map(category => [
                (category as CategoryChannel).children.find(
                    child =>
                        child.name === "queue" &&
                        child.type === "GUILD_TEXT"),
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
            .map(q => q.queueName)
            .filter((item, index, arr) =>
                arr.indexOf(item) !== index);
        if (duplicateQueues.length > 0) {
            console.warn(
                `Server["${this.guild.name}"] contains these duplicate queues:`
            );
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
     * ----
     * @param newQueueName name for this class/queue
     * @throws ServerError: if a queue with the same name already exists
    */
    async createQueue(newQueueName: string): Promise<void> {
        const existingQueues = this.queues.find(queue => queue.name === newQueueName);
        if (existingQueues !== undefined) {
            return Promise.reject(new ServerError(
                `Queue ${newQueueName} already exists`));
        }
        const parentCategory = await this.guild.channels.create(
            newQueueName,
            { type: "GUILD_CATEGORY" }
        );
        const [queueTextChannel] = await Promise.all([
            parentCategory.createChannel('queue'),
            parentCategory.createChannel('chat')
        ]);
        const queueChannel: QueueChannel = {
            channelObj: queueTextChannel,
            queueName: newQueueName,
            parentCategoryId: parentCategory.id
        };
        const [helpQueue] = await Promise.all([
            HelpQueueV2.create(
                queueChannel,
                this.user,
                this.guild.roles.everyone
            ),
            this.createClassRoles()
        ]);
        // update cache
        this.queueChannelsCache.push(queueChannel);
        this.queues.set(parentCategory.id, helpQueue);
    }

    /**
     * Deletes a queue by categoryID
     * ----
     * @param queueCategoryID CategoryChannel.id of the target queue
     * @throws ServerError: If a discord API failure happened
     * - #queue existence is checked by CentralCommandHandler
    */
    async deleteQueueById(queueCategoryID: string): Promise<void> {
        const queue = this.queues.get(queueCategoryID);
        if (queue === undefined) {
            return Promise.reject(new ServerError('This queue does not exist.'));
        }
        const parentCategory = await (await this.guild.channels.fetch())
            .find(ch => ch.id === queueCategoryID)
            ?.fetch() as CategoryChannel;
        // delete child channels first
        await Promise.all(parentCategory
            ?.children
            .map(child => child.delete())
            .filter(promise => promise !== undefined) as Promise<TextChannel>[]
        ).catch((err: Error) => {
            return Promise.reject(new ServerError(
                `API Failure: ${err.name}\n${err.message}`
            ));
        });
        // now delete category and role
        await Promise.all([
            parentCategory?.delete(),
            (await this.guild.roles.fetch())
                .find(role => role.name === parentCategory.name)
                ?.delete(),
            Promise.all(this.serverExtensions.map(
                extension => extension.onQueueDelete(this, queue)
            ))
        ]);
        // finally delete queue model and refresh cache
        this.queues.delete(queueCategoryID);
        await this.getQueueChannels(false);
    }

    /**
     * Attempt to enqueue a student
     * ----
     * @param studentMember student member to enqueue
     * @param queue target queue
     * @throws QueueError: if @param queue rejects
    */
    async enqueueStudent(
        studentMember: GuildMember,
        queue: QueueChannel
    ): Promise<void> {
        await this.queues
            .get(queue.parentCategoryId)
            ?.enqueue(studentMember);
    }

    /**
     * Dequeue the student that has been waiting for the longest
     * ----
     * @param helperMember the helper that used /next
     * @param specificQueue if specified, dequeue from this queue
     * @param targetStudentMember if specified, dequeue this student
     * - ignored if specified queue is undefined
     * @throws
     * - ServerError: if specificQueue is given but helper doesn't have the role
     * - QueueError: if the queue to dequeue from rejects
    */
    async dequeueFirst(
        helperMember: GuildMember,
        specificQueue?: QueueChannel,
        targetStudentMember?: GuildMember
    ): Promise<Readonly<Helpee>> {
        if (specificQueue !== undefined) {
            if (!helperMember.roles.cache.some(role => role.name === specificQueue.queueName)) {
                return Promise.reject(new ServerError(
                    `You don't have the permission to dequeue `
                    + `\`${specificQueue.queueName}\`.`
                ));
            }
            await this.queues
                .get(specificQueue.parentCategoryId)
                ?.dequeueWithHelper(helperMember, targetStudentMember);
        }
        const currentlyHelpingQueues = this.queues
            .filter(queue => queue.helperIDs.has(helperMember.id));
        if (currentlyHelpingQueues.size === 0) {
            return Promise.reject(new ServerError(
                'You are not currently hosting.'
            ));
        }
        const helperVoiceChannel = helperMember.voice.channel;
        if (helperVoiceChannel === null) {
            return Promise.reject(new ServerError(
                `You need to be in a voice channel first.`
            ));
        }
        const nonEmptyQueues = currentlyHelpingQueues
            .filter(queue => queue.currentlyOpen && queue.length !== 0);
        if (nonEmptyQueues.size === 0) {
            return Promise.reject(new ServerError(
                `There's no one left to help. You should get some coffee!`
            ));
        }
        const queueToDequeue = nonEmptyQueues.reduce<HelpQueueV2>(
            (prev, curr) =>
                (prev.first?.waitStart !== undefined &&
                    curr.first?.waitStart !== undefined) &&
                    prev.first?.waitStart.getTime() < curr.first?.waitStart.getTime()
                    ? prev
                    : curr
        );
        const student = await queueToDequeue
            .dequeueWithHelper(helperMember, targetStudentMember);

        this.activeHelpers.get(helperMember.id)?.helpedMembers.push(student);
        // this api call is slow
        await helperVoiceChannel.permissionOverwrites.create(student.member, {
            VIEW_CHANNEL: true,
            CONNECT: true,
        });
        const invite = await helperVoiceChannel.createInvite();
        await Promise.all([
            this.serverExtensions.map(
                extension => extension.onDequeueFirst(this, student)
            ),
            student.member.send(SimpleEmbed(
                `It's your turn! Join the call: ${invite.toString()}`,
                EmbedColor.Success
            ))
        ].flat() as Promise<void>[]);
        return student;
    }

    /**
     * Opens all the queue that the helper has permission to
     * ----
     * @param helperMember helper that used /start
     * @throws ServerError
     * - If the helper doesn't have any class roles
     * - If the helper is already hosting
    */
    async openAllOpenableQueues(helperMember: GuildMember, notify: boolean): Promise<void> {
        const openableQueues = this.queues
            .filter(queue => helperMember.roles.cache
                .map(role => role.name)
                .includes(queue.name));
        if (openableQueues.size === 0) {
            return Promise.reject(new ServerError(
                `It seems like you don't have any class roles.\n` +
                `This might be a human error. ` +
                `In the meantime, you can help students through DMs.`
            ));
        }
        await Promise.all(openableQueues.map(queue => queue.openQueue(helperMember, notify)))
            .catch(() => Promise.reject(new ServerError(
                'You are already hosting.'
            )));

        const helper: Helper = {
            helpStart: new Date(),
            helpedMembers: [],
            member: helperMember
        };

        this.helpers.set(helperMember.id, helper);

        await Promise.all(this.serverExtensions.map(
            extension => extension.onHelperStartHelping(this, helper)
        ));
    }

    /**
    * Closes all the queue that the helper has permission to
    * Also logs the help time to the console
    * ----
    * @param helperMember helper that used /stop
    * @throws ServerError: If the helper is not hosting
   */
    async closeAllClosableQueues(helperMember: GuildMember): Promise<Required<Helper>> {
        const helper = this.helpers.get(helperMember.id);
        if (helper === undefined) {
            return Promise.reject(new ServerError(
                'You are not currently hosting.'
            ));
        }
        const closableQueues = this.queues.filter(
            queue => helperMember.roles.cache
                .map(role => role.name)
                .includes(queue.name));
        await Promise.all(closableQueues.map(queue => queue.closeQueue(helperMember)))
            .catch(() => Promise.reject(new ServerError(
                'You are not currently hosting.'
            )));

        helper.helpEnd = new Date();
        this.helpers.delete(helperMember.id);
        console.log(`- Help time of ${helper.member.displayName} is ` +
            `${msToHourMins(helper.helpEnd.getTime() - helper.helpStart.getTime())}`);

        await Promise.all(this.serverExtensions.map(
            extension => extension.onHelperStopHelping(this, helper as Required<Helper>)
        ));
        return helper as Required<Helper>;
    }

    /**
     * Removes a student from a given queue
     * ----
     * @param studentMember student that used /leave or the cleave button
     * @param targetQueue the queue to leave from
     * @throws QueueError: if @param targetQueue rejects
    */
    async removeStudentFromQueue(
        studentMember: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        await this.queues
            .get(targetQueue.parentCategoryId)
            ?.removeStudent(studentMember);
    }

    async clearQueue(targetQueue: QueueChannel): Promise<void> {
        await this.queues
            .get(targetQueue.parentCategoryId)
            ?.removeAllStudents();
    }

    async addStudentToNotifGroup(
        studentMember: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        await this.queues
            .get(targetQueue.parentCategoryId)
            ?.addToNotifGroup(studentMember);
    }

    async removeStudentFromNotifGroup(
        studentMember: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        await this.queues
            .get(targetQueue.parentCategoryId)
            ?.removeFromNotifGroup(studentMember);
    }

    /**
     * Send an announcement to all the students in the helper's approved queues
     * ----
     * @param helperMember helper that used /announce
     * @param message announcement body
     * @param targetQueue optional, specifies which queue to announce to
    */
    async announceToStudentsInQueue(
        helperMember: GuildMember,
        message: string,
        targetQueue?: QueueChannel
    ): Promise<void> {
        if (targetQueue) {
            const queueToAnnounce = this.queues
                .get(targetQueue.parentCategoryId);
            if (queueToAnnounce === undefined ||
                // do this first, so the expensive Array.some() won't be called unless this is false
                !queueToAnnounce.helperIDs.has(helperMember.id) &&
                helperMember.roles.cache.some(role => role.name === 'Bot Admin')) {
                return Promise.reject(new ServerError(
                    `You don't have permission to announce in ${targetQueue.queueName}. ` +
                    `Check your class roles.`
                ));
            }
            await Promise.all(queueToAnnounce.studentsInQueue
                .map(student => student.member.send(SimpleEmbed(
                    `Staff member ${helperMember.displayName} announced: ${message}`,
                    EmbedColor.Aqua,
                    `In queue: ${targetQueue.queueName}`
                )))
            );
            return;
        }
        // from this.queues select queue where queue.helpers has helperMember.id
        await Promise.all(this.queues
            .filter(queue => queue.helperIDs.has(helperMember.id))
            .map(queueToAnnounce => queueToAnnounce.studentsInQueue)
            .flat()
            .map(student => student.member.send((SimpleEmbed(
                `Staff member ${helperMember.displayName} announced: ${message}`,
                EmbedColor.Aqua
            ))))
        );
    }

    /**
     * Cleans up the given queue and resend all embeds
     * @param targetQueue the queue to clean
    */
    async cleanUpQueue(targetQueue: QueueChannel): Promise<void> {
        await this.queues
            .get(targetQueue.parentCategoryId)
            ?.cleanUpQueueChannel();
    }

    async setAfterSessionMessage(newMessage: string): Promise<void> {
        this.afterSessionMessage = newMessage;
        // trigger anything listening to internal updates
        await Promise.all(this.serverExtensions.map(
            extension => extension.onServerPeriodicUpdate(this, false)
        ));
    }

    /**
     * Updates the help channel messages
     * ----
     * Removes all messages in the help channel and posts new ones
    */
    async updateCommandHelpChannels(): Promise<void> {
        const allChannels = await this.guild.channels.fetch();
        const existingHelpCategory = allChannels
            .filter(
                channel =>
                    channel.type === "GUILD_CATEGORY" &&
                    channel.name === "Bot Commands Help"
            )
            .map(channel => channel as CategoryChannel);
        // If no help category is found, initialize
        if (existingHelpCategory.length === 0) {
            console.log(
                `${FgCyan}Found no help channels in ${this.guild.name}. ` +
                `Creating new ones.${ResetColor}`
            );

            const helpCategory = await this.guild.channels.create(
                "Bot Commands Help",
                { type: "GUILD_CATEGORY" }
            );
            existingHelpCategory.push(helpCategory);

            // Change the config object and add more functions here if needed
            await Promise.all(commandChConfigs.map(async roleConfig => {
                const commandCh = await helpCategory
                    .createChannel(roleConfig.channelName);
                await commandCh.permissionOverwrites.create(
                    this.guild.roles.everyone,
                    {
                        SEND_MESSAGES: false,
                        VIEW_CHANNEL: false
                    });
                await Promise.all(
                    this.guild.roles.cache
                        .filter(role => roleConfig.visibility.includes(role.name))
                        .map(roleWithViewPermission =>
                            commandCh.permissionOverwrites.create(
                                roleWithViewPermission,
                                { VIEW_CHANNEL: true })
                        ));
            }));
        } else {
            console.log(
                `${FgYellow}Found existing help channels in ${this.guild.name}, ` +
                ` updating command help files${ResetColor}`
            );
        }
        await this.sendCommandHelpMessages(existingHelpCategory, commandChConfigs);
        console.log(`${FgMagenta}✓ Updated help channels ✓${ResetColor}`);
    }

    /**
     * Creates all the office hour queues
     * ----
     * @param queueBackups
     * - if a backup extension is enabled, this is the queue data to load
     */
    private async initAllQueues(queueBackups?: QueueBackup[]): Promise<void> {
        if (this.queues.size !== 0) {
            console.warn("Overriding existing queues.");
        }
        const queueChannels = await this.getQueueChannels(false);
        await Promise.all(queueChannels
            .map(async channel => this.queues.set(channel.parentCategoryId,
                await HelpQueueV2.create(
                    channel,
                    this.user,
                    this.guild.roles.everyone,
                    // TODO: this is N^2, a bit slow
                    queueBackups?.find(backup =>
                        backup.parentCategoryId === channel.parentCategoryId)
                )))
        );
        const disableExtensions = process.argv.slice(2)[0]?.split('=')[1] === 'true';
        console.log(`All queues in '${this.guild.name}' successfully created` +
            `${disableExtensions
                ? ''
                : ` ${FgBlue}with their extensions${ResetColor}`}!`
        );
        await Promise.all(this.serverExtensions.map(
            extension => extension.onAllQueuesInit(this, [...this.queues.values()])
        ));
    }

    /**
     * Creates all the command access hierarchy roles
     * ----
     */
    private async createHierarchyRoles(): Promise<void> {
        const existingRoles = (await this.guild.roles.fetch())
            .filter(role =>
                role.name !== this.user.username &&
                role.name !== '@everyone')
            .map(role => role.name);
        const createdRoles = await Promise.all(
            hierarchyRoleConfigs
                .filter(role => !existingRoles.includes(role.name))
                .map(roleConfig => this.guild.roles.create(roleConfig))
        );
        if (createdRoles.length !== 0) {
            console.log("Created roles:");
            console.log(createdRoles
                .map(r => { return { name: r.name, pos: r.position }; })
                .sort((a, b) => a.pos - b.pos));
        } else {
            console.log('All required roles exist!');
        }
        // Give everyone the student role
        const studentRole = this.guild.roles.cache.find(role => role.name === 'Student');
        await Promise.all(this.guild.members.cache.map(async member => {
            if (member.user.id !== this.user.id && studentRole) {
                await member.roles.add(studentRole);
            }
        }));
    }

    /**
     * Creates roles for all the available queues if not already created
     * ----
     */
    private async createClassRoles(): Promise<void> {
        const existingRoles = new Set(this.guild.roles.cache
            .map(role => role.name));
        const queueNames = (await this.getQueueChannels())
            .map(ch => ch.queueName);
        await Promise.all(
            queueNames
                .filter(queue => !existingRoles.has(queue))
                .map(async roleToCreate =>
                    await this.guild.roles.create({
                        name: roleToCreate,
                        position: 1,
                    }))
        );
    }

    /**
     * Overwrites the existing command help channel and send new help messages
     * ----
    */
    private async sendCommandHelpMessages(
        helpCategories: CategoryChannel[],
        messageContents: {
            channelName: string;
            file: Pick<MessageOptions, "embeds">[];
            visibility: string[];
        }[],
    ): Promise<void> {
        const allHelpChannels = helpCategories.flatMap(
            category => [...category.children.values()]
                .filter(ch => ch.type === "GUILD_TEXT") as TextChannel[]);
        await Promise.all(
            allHelpChannels.map(async ch => await ch.messages
                .fetch()
                .then(messages => messages.map(msg => msg.delete())))
        );
        // send new ones
        await Promise.all(
            allHelpChannels.map(async ch => {
                const file = messageContents.find(
                    val => val.channelName === ch.name
                )?.file;
                file && file.forEach(async message => {
                    await ch.send(message);
                });
            })
        );
    }
}

export { AttendingServerV2, QueueChannel };
