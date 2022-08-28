import {
    CategoryChannel,
    Guild,
    GuildMember,
    TextChannel,
    User,
} from "discord.js";
import { HelpQueueV2 } from "../help-queue/help-queue";
import { EmbedColor, SimpleEmbed } from "../utils/embed-helper";
import { Firestore } from "firebase-admin/firestore";
import { commandChConfigs } from "./command-ch-constants";
import { hierarchyRoleConfigs } from "../models/access-level";
import { ServerError } from "../utils/error-types";
import { Helpee, Helper } from "../models/member-states";

// Wrapper for TextChannel
// Guarantees that a queueName exists
type QueueChannel = {
    channelObj: TextChannel;
    queueName: string;
};

/**
 * V2 of attending server
 * ----
 * -  Cannot be extended
 * - To add functionalities, either modify this class or make an extension
*/
class AttendingServerV2 {
    private queues: HelpQueueV2[] = [];

    private constructor(
        public readonly user: User,
        public readonly guild: Guild,
        public readonly firebaseDB: Firestore,
    ) { }

    /**
     * Asynchronously creates a YABOB instance for 1 server
     * ----
     * @param user discord client user
     * @param guild the server for YABOB to join
     * @param firebaseDB firebase database object
     * @returns a created instance of YABOB
     * @throws UserError
     */
    static async create(
        user: User,
        guild: Guild,
        firebaseDB: Firestore
    ): Promise<AttendingServerV2> {
        if (guild.me === null ||
            !guild.me.permissions.has("ADMINISTRATOR")
        ) {
            const owner = await guild.fetchOwner();
            await owner.send(
                SimpleEmbed(
                    `Sorry, I need full administrator permission for "${guild.name}"`,
                    EmbedColor.Error));
            await guild.leave();
            throw Error("YABOB doesn't have admin permission.");
        }

        console.log(`Creating new YABOB for server: ${guild.name}`);
        const me = new AttendingServerV2(user, guild, firebaseDB);

        // ! this call must block everything else
        // Disabled for dev environment assuming everything is created
        if (process.env.NODE_ENV === 'Production') {
            await me.createHierarchyRoles();
        }
        // the ones below can be launched in parallel
        await Promise.all([
            me.initAllQueues(),
            me.createClassRoles(),
            me.updateCommandHelpChannels()
        ]).catch(err => {
            console.error(err);
            throw Error(`❗ \x1b[31mInitilization for ${guild.name} failed.\x1b[0m`);
        });
        console.log(`⭐ \x1b[32mInitilization for ${guild.name} is successful!\x1b[0m`);

        return me;
    }

    getAllQueueNames(): string[] {
        return this.queues.map(queue => queue.name);
    }

    getHelpQueues(): Readonly<HelpQueueV2[]> {
        return this.queues;
    }

    getAllHelpers(): Set<string> {
        return new Set(this.queues
            .flatMap(q => [...q.helpers.values()])
            .map(helper => helper.member.displayName));
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
            .map(ch => ch as CategoryChannel)
            .map(category => [
                category.children.find(
                    child =>
                        child.name === "queue" &&
                        child.type === "GUILD_TEXT"),
                category.name,
            ])
            .filter(([ch]) => ch !== undefined)
            .map(([ch, name]) => {
                return {
                    channelObj: ch,
                    queueName: name,
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
     * Creates all the office hour queues
     * ----
     */
    async initAllQueues(): Promise<void> {
        if (this.queues.length !== 0) {
            console.warn("Overriding existing queues.");
        }
        const queueChannels = await this.getQueueChannels();
        this.queues = await Promise
            .all(queueChannels
                .map(channel => HelpQueueV2
                    .create(channel, this.user, this.guild.roles.everyone)));
    }

    /**
     * Updates the help channels
     * ----
     * Removes all messages in the help channel and posts new ones
    */
    async updateCommandHelpChannels(): Promise<void> {
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
            console.log("\x1b[35mFound no help channels. Creating new ones.\x1b[0m");

            const helpCategory = await this.guild.channels.create(
                "Bot Commands Help",
                { type: "GUILD_CATEGORY" }
            );
            existingHelpCategory.push(helpCategory);

            // Change the config object and add more functions here if needed
            for (const role of Object.values(commandChConfigs)) {
                const commandCh = await helpCategory.createChannel(
                    role.channelName
                );
                await commandCh.permissionOverwrites.create(
                    this.guild.roles.everyone,
                    { SEND_MESSAGES: false });
                await commandCh.permissionOverwrites.create(
                    this.user,
                    { SEND_MESSAGES: true });
            }
        } else {
            console.log(
                "\x1b[33mFound existing help channels, updating command help file\x1b[0m"
            );
        }
        await this.sendCommandHelpMessages(existingHelpCategory);
    }

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
            queueName: name
        };

        await parentCategory.createChannel('chat');
        await this.createClassRoles();

        this.queues.push(await HelpQueueV2.create(
            queueChannel,
            this.user,
            this.guild.roles.everyone));
    }

    async deleteQueueById(queueCategoryID: string): Promise<void> {
        const queueIndex = this.queues
            .findIndex(queue => queue.channelObj.parent?.id === queueCategoryID);
        if (queueIndex === -1) {
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
        this.queues.splice(queueIndex, 1);
    }

    async enqueueStudent(
        student: GuildMember,
        queue: QueueChannel): Promise<void> {
        const helpee: Helpee = {
            waitStart: new Date(),
            upNext: false,
            member: student
        };

        await this.queues
            .find(q => q.channelObj.id === queue.channelObj.id)
            ?.enqueue(helpee);
    }

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
        const helperVoiceChannel = helperMember.voice.channel;
        if (helperVoiceChannel === null) {
            return Promise.reject(new ServerError(
                `You need to be in a voice channel first.`
            ));
        }
        const nonEmptyQueues = this.queues
            .filter(queue => queue.currentlyOpen && queue.length !== 0);
        if (nonEmptyQueues.length === 0) {
            return Promise.reject(new ServerError(
                `There's no one left to help. You should get some coffee!`
            ));
        }
        const queueToDeq = nonEmptyQueues.reduce((prev, curr) =>
            (prev.first?.waitStart !== undefined &&
                curr.first?.waitStart !== undefined) &&
                prev.first?.waitStart.getTime() < curr.first?.waitStart.getTime()
                ? prev
                : curr
        );
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
        return student;
    }

    async openAllOpenableQueues(member: GuildMember): Promise<void> {
        const openableQueues = this.queues
            .filter(queue => member.roles.cache
                .map(role => role.name)
                .includes(queue.name));
        if (openableQueues.length === 0) {
            return Promise.reject(new ServerError(
                `It seems like you don't have any class roles.\n` +
                `This might be a human error. ` +
                `In the meantime, you can help students through DMs.`
            ));
        }
        await Promise.all(openableQueues.map(queue => queue.openQueue(member)))
            .catch(() => Promise.reject(new ServerError(
                'You are already hosting.'
            )));
    }

    async closeAllClosableQueues(member: GuildMember): Promise<Readonly<Helper>> {
        const closableQueues = this.queues
            .filter(queue => member.roles.cache
                .map(role => role.name)
                .includes(queue.name));
        // since each queue maintain a set of helpers, take the max
        const helpTimes = await Promise.all(
            closableQueues.map(queue => queue.closeQueue(member)))
            .catch(() => Promise.reject(new ServerError(
                'You are not currently hosting.'
            )));
        const maxHelpTime = helpTimes.reduce((prev, curr) =>
            prev.helpEnd.getTime() > curr.helpStart.getTime()
                ? prev
                : curr
        );
        console.log(`HelpTime of ${maxHelpTime.member.displayName} is ` +
            `${maxHelpTime.helpEnd.getTime() - maxHelpTime.helpStart.getTime()}`);
        // emit onAllClosableQueuesClose() event here
        return maxHelpTime;
    }

    async removeStudentFromQueue(
        member: GuildMember,
        targetQueue: QueueChannel
    ): Promise<void> {
        const queueToRemoveFrom = this.queues
            .find(queue => queue.name === targetQueue.queueName);
        await queueToRemoveFrom?.removeStudent(member);
    }

    async clearQueue(
        targetQueue: QueueChannel
    ): Promise<void> {
        const queueToClear = this.queues
            .find(queue => queue.name === targetQueue.queueName);
        await queueToClear?.removeAllStudents();
    }


    /**
     * Creates all the command access hierarchy roles
     * ----
     */
    private async createHierarchyRoles(): Promise<void> {
        const existingRoles = (await this.guild.roles.fetch())
            .filter(role => role.name !== this.user.username &&
                role.name !== '@everyone');
        await Promise.all(existingRoles.map(role => role.delete()));
        const createdRoles = await Promise.all(hierarchyRoleConfigs
            .map(async roleConfig =>
                await this.guild.roles.create(roleConfig)));
        console.log("Created roles:");
        console.log(createdRoles
            .map(r => { return { name: r.name, pos: r.position }; })
            .sort((a, b) => a.pos - b.pos));
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
        console.log(`Created class roles: ${queueNames
            .filter(queue => !existingRoles.has(queue))}`);
        await Promise.all(queueNames
            .filter(queue => !existingRoles.has(queue))
            .map(async roleToCreate =>
                await this.guild.roles.create({
                    name: roleToCreate,
                    position: 1,
                })));
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
        if (helpCategories.length === 0 ||
            allHelpChannels.length === 0) {
            console.warn("\x1b[31mNo help categories found.\x1b[0m");
            console.log(
                "Did you mean to call \x1b[32mupdateCommandHelpChannels()\x1b[0m?"
            );
            return;
        }
        // delete all existing messages
        await Promise.all(
            allHelpChannels.map(async ch => await ch.messages
                .fetch()
                .then(messages => messages.map(msg => msg.delete()))));
        // send new ones
        await Promise.all(
            allHelpChannels.map(async ch => {
                const file = Object.values(commandChConfigs).find(
                    val => val.channelName === ch.name
                )?.file;
                if (file) { await ch.send(SimpleEmbed(file)); }
            }));
    }
}

export { AttendingServerV2, QueueChannel };
