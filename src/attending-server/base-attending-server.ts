import {
    CategoryChannel,
    Collection,
    Guild,
    GuildMember,
    TextChannel,
    User,
} from "discord.js";
import { HelpQueueV2 } from "../help-queue/help-queue";
import { EmbedColor, SimpleEmbed } from "../utils/embed-helper";
import { commandChConfigs } from "./command-ch-constants";
import { hierarchyRoleConfigs } from "../models/hierarchy-roles";
import { ServerError } from "../utils/error-types";
import { Helpee, Helper } from "../models/member-states";

import { IServerExtension } from "../extensions/extension-interface";
import { AttendanceExtension } from "../extensions/attendance/attendance-extension";
import { FirebaseLoggingExtension } from '../extensions/firebase-backup/firebase-extension';
import { QueueBackup } from "../extensions/firebase-backup/firebase-models/backups";
import { FgCyan, FgGreen, FgRed, FgYellow, ResetColor } from "../utils/command-line-colors";

// Wrapper for TextChannel
// Guarantees that a queueName exists
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

    // Key is CategoryChannel.id of the parent catgory of #queue
    private queues: Collection<string, HelpQueueV2> = new Collection();
    public intervalID!: NodeJS.Timer;

    protected constructor(
        public readonly user: User,
        public readonly guild: Guild,
        private readonly serverExtensions: IServerExtension[],
    ) { }

    get helpQueues(): ReadonlyArray<HelpQueueV2> {
        return [...this.queues.values()];
    }
    get helperNames(): ReadonlySet<string> {
        return new Set(this.queues
            .map(q => q.currentHelpers)
            .flat()
            .map(helper => helper.member.displayName));
    }

    clearAllIntervals(): void {
        // Types are ignored here b/c TS doesn't recognize the Timout overload for clearInterval
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
        const serverExtensions = await Promise.all([
            AttendanceExtension.load(guild.name),
            FirebaseLoggingExtension.load(guild.name, guild.id)
        ]);
        // Retrieve backup from all sources. Take the first one that's not undefined 
        // Change behavior here depending on backup strategy
        const externalBackup = await Promise.all(
            serverExtensions.map(extension => extension.loadExternalServerData(guild.id))
        );
        const externalServerData = externalBackup.find(backup => backup !== undefined);
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

        // This call must block everything else for handling empty servers
        await server.createHierarchyRoles();
        // The ones below can be launched together. After this Promise the server is ready
        await Promise.all([
            server.initAllQueues(externalServerData?.queues),
            server.createClassRoles(),
            server.updateCommandHelpChannels()
        ]).catch(err => {
            console.error(err);
            throw new ServerError(`❗ ${FgRed}Initilization for ${guild.name} failed.${ResetColor}`);
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

        console.log(`⭐ ${FgGreen}Initilization for ${guild.name} is successful!${ResetColor}`);
        return server;
    }

    /**
     * Gets all the queue channels on the server
     * ----
     * if nothing is found, returns empty array
     * @param useCache whether to read from existing cache, defaults to true
     * - unless queues change often, prefer cache for fast response
     */
    async getQueueChannels(useCache = true): Promise<QueueChannel[]> {
        const allChannels = useCache
            ? this.guild.channels.cache
            : await this.guild.channels.fetch();
        const queueChannels = allChannels
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

        const duplicateQueues = queueChannels
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

        return queueChannels;
    }

    /**
     * Creates a new OH queue
     * ----
     * @param name name for this class/queue
     * @throws ServerError: if a queue with the same name already exists
    */
    async createQueue(name: string): Promise<void> {
        const existingQueues = await this.getQueueChannels();
        const existQueueWithSameName = existingQueues
            .find(queue => queue.queueName === name)
            !== undefined;

        if (existQueueWithSameName) {
            return Promise.reject(new ServerError(
                `Queue ${name} already exists`));
        }

        const parentCategory = await this.guild.channels.create(
            name,
            { type: "GUILD_CATEGORY" }
        );
        const queueChannel: QueueChannel = {
            channelObj: await parentCategory.createChannel('queue'),
            queueName: name,
            parentCategoryId: parentCategory.id
        };

        await parentCategory.createChannel('chat');
        await this.createClassRoles();

        this.queues.set(parentCategory.id, await HelpQueueV2.create(
            queueChannel,
            this.user,
            this.guild.roles.everyone
        ));
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
        // now delete category
        await parentCategory?.delete();
        await (await this.guild.roles.fetch())
            .find(role => role.name === parentCategory.name)
            ?.delete();
        // finally delete queue model
        this.queues.delete(queueCategoryID);
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
            .find(q => q.channelObj.id === queue.channelObj.id)
            ?.enqueue(studentMember);
    }

    /**
     * Dequeue the student that has been waiting for the longest
     * ----
     * @param helperMember the helper that used /next
     * @param specificQueue if specified, dequeue from this queue
     * @throws
     * - ServerError: if specificQueue is given but helper doesn't have the role
     * - QueueError: if the queue to dequeue from rejects
    */
    async dequeueFirst(
        helperMember: GuildMember,
        specificQueue?: QueueChannel): Promise<Readonly<Helpee>> {
        if (specificQueue !== undefined) {
            if (!helperMember.roles.cache.has(specificQueue.queueName)) {
                return Promise.reject(new ServerError(
                    `You don't have the permission to dequeue `
                    + `\`${specificQueue.queueName}\`.`
                ));
            }
            this.queues
                .find(queue => queue.name === specificQueue.queueName)
                ?.dequeueWithHelper(helperMember);
        }
        const currentlyHelpingChannels = this.queues
            .filter(queue => queue.helperIDs.has(helperMember.id));
        // this is here to prevent empty currentlyHelpingChannels from calling reduce
        // i forgot how it could be empty tho
        if (currentlyHelpingChannels.size === 0) {
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
        const nonEmptyQueues = currentlyHelpingChannels
            .filter(queue => queue.currentlyOpen && queue.length !== 0);
        if (nonEmptyQueues.size === 0) {
            return Promise.reject(new ServerError(
                `There's no one left to help. You should get some coffee!`
            ));
        }
        const queueToDeq = nonEmptyQueues.reduce<HelpQueueV2>((prev, curr) =>
            (prev.first?.waitStart !== undefined &&
                curr.first?.waitStart !== undefined) &&
                prev.first?.waitStart.getTime() < curr.first?.waitStart.getTime()
                ? prev
                : curr);
        const student = await queueToDeq.dequeueWithHelper(helperMember);
        await helperVoiceChannel.permissionOverwrites.create(student.member, {
            VIEW_CHANNEL: true,
            CONNECT: true,
        });
        const invite = await helperVoiceChannel.createInvite();
        await student.member.send(SimpleEmbed(
            `It's your turn! Join the call: ${invite.toString()}`,
            EmbedColor.Success
        ));

        await Promise.all(this.serverExtensions.map(
            extension => extension.onDequeueFirst(student)
        ));
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

        // only used for onHelperStartHelping()
        const helper: Helper = {
            helpStart: new Date,
            helpedMembers: [],
            member: helperMember
        };

        await Promise.all(this.serverExtensions.map(
            extension => extension.onHelperStartHelping(helper)
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
        const closableQueues = this.queues.filter(
            queue => helperMember.roles.cache
                .map(role => role.name)
                .includes(queue.name));
        if (closableQueues.size === 0) {
            return Promise.reject(new ServerError(
                'You are not currently hosting.'
            ));
        }
        const helpTimes = await Promise.all(
            closableQueues.map(queue => queue.closeQueue(helperMember)))
            .catch(() => Promise.reject(new ServerError(
                'You are not currently hosting.'
            )));
        // Since each queue maintains a helper object, we take the one with maximum time (argmax)
        // The time offsets between each queue is negligible
        const maxHelpTime = helpTimes.reduce((prev, curr) =>
            prev.helpEnd.getTime() > curr.helpStart.getTime()
                ? prev
                : curr
        );
        console.log(`- Help time of ${maxHelpTime.member.displayName} is ` +
            `${maxHelpTime.helpEnd.getTime() - maxHelpTime.helpStart.getTime()}ms.`);
        await Promise.all(this.serverExtensions.map(
            extension => extension.onHelperStopHelping(maxHelpTime)
        ));
        return maxHelpTime;
    }

    /**
     * Removes a student from a given queue
     * ----
     * @param studentMember student that used /leave or the leave button
     * @param targetQueue the queue to leave from
     * @throws QueueError: if @param targetQueue rejects
    */
    async removeStudentFromQueue(
        studentMember: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        const queueToRemoveFrom = this.queues
            .find(queue => queue.name === targetQueue.queueName);
        await queueToRemoveFrom?.removeStudent(studentMember);
    }

    async clearQueue(targetQueue: QueueChannel): Promise<void> {
        const queueToClear = this.queues
            .find(queue => queue.name === targetQueue.queueName);
        await queueToClear?.removeAllStudents();
    }

    async addStudentToNotifGroup(
        studentMember: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        const queueToJoinNotif = this.helpQueues
            .find(queue => queue.name === targetQueue.queueName);
        await queueToJoinNotif?.addToNotifGroup(studentMember);
    }

    async removeStudentFromNotifGroup(
        studentMember: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        const queueToJoinNotif = this.helpQueues
            .find(queue => queue.name === targetQueue.queueName);
        await queueToJoinNotif?.removeFromNotifGroup(studentMember);
    }

    async announceToStudentsInQueue(
        helperMember: GuildMember,
        message: string,
        targetQueue?: QueueChannel
    ): Promise<void> {
        if (targetQueue) {
            const queueToAnnounce = this.queues
                .find(queue =>
                    queue.name === targetQueue.queueName &&
                    queue.helperIDs.has(helperMember.id)
                );
            if (queueToAnnounce === undefined) {
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
        }
        // from this.queues select queue where queue.helpers has helperMember.id
        await Promise.all(this.queues
            .filter(queue => queue.helperIDs.has(helperMember.id))
            .map(queueToAnnounce => queueToAnnounce.studentsInQueue)
            .flat()
            .map(student => student.member.send(SimpleEmbed(message)))
        );
    }

    /**
     * Cleans up the given queue and resend all embeds
     * @param targetQueue the queue to clean
    */
    async cleanUpQueue(targetQueue: QueueChannel): Promise<void> {
        const queueToClean = this.queues
            .find(queue => queue.name === targetQueue.queueName);
        await queueToClean?.cleanUpQueueChannel();
    }

    /**
     * Creates all the office hour queues
     * ----
     */
    private async initAllQueues(queueBackups?: QueueBackup[]): Promise<void> {
        if (this.queues.size !== 0) {
            console.warn("Overriding existing queues.");
        }
        const queueChannels = await this.getQueueChannels();
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
        console.log(`All queues in '${this.guild.name}' successfully created with their extensions!`);
        await Promise.all(this.serverExtensions.map(
            extension => extension.onAllQueueInit([...this.queues.values()])
        ));
    }

    /**
     * Updates the help channel messages
     * ----
     * Removes all messages in the help channel and posts new ones
    */
    private async updateCommandHelpChannels(): Promise<void> {
        const allChannels = await this.guild.channels.fetch();
        const existingHelpCategory = allChannels
            .filter(
                ch =>
                    ch.type === "GUILD_CATEGORY" &&
                    ch.name === "Bot Commands Help"
            )
            .map(ch => ch as CategoryChannel);

        // If no help category is found, initialize
        if (existingHelpCategory.length === 0) {
            console.log(`${FgCyan}Found no help channels. Creating new ones.${ResetColor}`);

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
                await commandCh.permissionOverwrites.create(
                    this.user,
                    { SEND_MESSAGES: true });
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
                `${FgYellow}Found existing help channels, updating command help file${ResetColor}`
            );
        }

        await this.sendCommandHelpMessages(existingHelpCategory);
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
                    await this.guild.roles.create(
                        {
                            name: roleToCreate,
                            position: 1,
                        }
                    ))
        );
    }

    /**
     * Overwrites the existing command help channel and send new help messages
     * ----
    */
    private async sendCommandHelpMessages(
        helpCategories: CategoryChannel[]
    ): Promise<void> {
        const allHelpChannels = helpCategories.flatMap(
            category => [...category.children.values()]
                .filter(ch => ch.type === "GUILD_TEXT") as TextChannel[]);
        // delete all existing messages
        await Promise.all(
            allHelpChannels.map(async ch => await ch.messages
                .fetch()
                .then(messages => messages.map(msg => msg.delete())))
        );
        // send new ones
        await Promise.all(
            allHelpChannels.map(async ch => {
                const file = commandChConfigs.find(
                    val => val.channelName === ch.name
                )?.file;
                if (file) {
                    await ch.send(file);
                }
            })
        );
    }
}

export { AttendingServerV2, QueueChannel };
