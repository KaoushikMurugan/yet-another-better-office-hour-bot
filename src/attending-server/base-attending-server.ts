// V2 of attending server
import {
    CategoryChannel,
    Guild,
    TextChannel,
    User,
    GuildMember,
    ColorResolvable,
    RoleData,
} from "discord.js";
import { HelpQueue } from "../queue";
import { UserError } from "../user_action_error";
import { MemberStateV2 } from "../models/member-states";
import { EmbedColor, SimpleEmbed } from "../embed_helper";
import { Firestore } from "firebase-admin/firestore";
import { CommandChConfig } from "./command-ch-constants";
import { hierarchyRoleConfigs } from "../models/access-level";

// Wrapper for TextChannel
// Guarantees that a queue_name exists
type QueueChannel = {
    channelObject: TextChannel;
    queueName: string;
};

interface BOBServer {
    getQueueChannels: (use_cache: boolean) => Promise<QueueChannel[]>;
    initAllQueues: () => Promise<void>;
    updateCommandHelpChannels: () => Promise<void>;
}

class AttendingServerV2 {
    private queues: HelpQueue[] = [];

    private constructor(
        private readonly user: User,
        private readonly guild: Guild,
        private readonly firebaseDB: Firestore,
        private memberStates = new Map<GuildMember, MemberStateV2>()
    ) { }

    /**
     * Asynchronously creates a YABOB instance for 1 server
     * ----
     * @param user discord client user
     * @param server the server for YABOB to join
     * @param firebaseDB firebase database object
     * @returns a created instance of YABOB
     * @throws UserError
     */
    static async create(
        user: User,
        server: Guild,
        firebaseDB: Firestore
    ): Promise<AttendingServerV2> {
        if (server.me === null
            || !server.me.permissions.has("ADMINISTRATOR")) {
            const owner = await server.fetchOwner();
            await owner.send(
                SimpleEmbed(
                    `Sorry, I need full administrator permission for "${server.name}"`,
                    EmbedColor.Error));
            await server.leave();
            throw new UserError("YABOB doesn't have admin permission.");
        }

        console.log(`Creating new YABOB for server: ${server.name}`);
        const me = new AttendingServerV2(user, server, firebaseDB);

        // await me.createHierarchyRoles();
        await me.createClassRoles();

        // await me.updateCommandHelpChannels();

        return me;
    }

    /**
     * Gets all the queue channels on the server
     * ----
     * if nothing is found, returns empty array
     * @param use_cache whether to read from existing cache, defaults to true
     * - unless queues change often, prefer cache for fast response
     */
    async getQueueChannels(use_cache = true): Promise<QueueChannel[]> {
        const allChannels = use_cache
            ? this.guild.channels.cache
            : await this.guild.channels.fetch();
        const queueChannels = allChannels
            // type checking done here
            .filter(ch => ch.type === "GUILD_CATEGORY")
            // ch has type 'AnyChannel', have to cast
            .map(ch => ch as CategoryChannel)
            .map(category => [
                category.children.find(
                    child =>
                        child.name === "queue" && child.type === "GUILD_TEXT"
                ),
                category.name,
            ])
            .filter(([ch]) => ch !== undefined)
            .map(([ch, name]) => {
                return {
                    channelObject: ch,
                    queueName: name,
                } as QueueChannel;
            });

        const duplicateQueues = queueChannels
            .map(q => q.queueName)
            .filter((item, index, arr) => arr.indexOf(item) !== index);

        if (duplicateQueues.length > 0) {
            console.warn(
                `The server "${this.guild.name}" contains these duplicate queues:`
            );
            console.warn(duplicateQueues);
            console.warn(
                `This might lead to undefined behaviors when students try to join them.\n
                Please update category names as soon as possible.`
            );
        }

        return queueChannels;
    }

    /**
     * Creates all the office hour queues
     */
    async initAllQueues(): Promise<void> {
        if (this.queues.length !== 0) {
            console.warn("Overriding existing queues.");
        }

        const queueChannels = await this.getQueueChannels();
    }

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
            console.log("\x1b[33mFound no help channels. Creating new ones.");

            const helpCategory = await this.guild.channels.create(
                "Bot Commands Help",
                { type: "GUILD_CATEGORY" }
            );
            existingHelpCategory.push(helpCategory);

            for (const role of Object.values(CommandChConfig)) {
                const commandCh = await helpCategory.createChannel(
                    role.channelName
                );

                // ? doesn't block server owner
                await commandCh.permissionOverwrites.create(
                    this.guild.roles.everyone,
                    { SEND_MESSAGES: false }
                );
                await commandCh.permissionOverwrites.create(
                    this.user,
                    { SEND_MESSAGES: true }
                );

                // * Change the config object,
                // * and add more function calls here if necessary
            }
        } else {
            console.log(
                "\x1b[33mFound existing help channel, updating command help file\x1b[0m"
            );
        }

        await this.sendCommandHelpMessages(existingHelpCategory);
    }

    /**
     * Creates all the command access hierarchy roles
     * ----
     */
    async createHierarchyRoles(): Promise<void> {
        const existingRoles = (await this.guild.roles.fetch()).map(
            role => role.name
        );

        // create all the missing roles to bump up YABOB's role
        await Promise.all(hierarchyRoleConfigs
            .filter(roleConfig => !existingRoles.includes(roleConfig.name))
            .map(async roleConfig =>
                await this.guild.roles.create(roleConfig)));

        console.log("Initially create roles:");
        console.log(this.guild.roles.cache.map(r => [r.name, r.position]));
    }

    /**
     * Creates roles for all the available queues if not already created
     * ----
     */
    async createClassRoles(): Promise<void> {
        const existingRoles = this.guild.roles.cache
            .map(role => role.name);
        const queueNames = (await this.getQueueChannels())
            .map(ch => ch.queueName);
        await Promise.all(queueNames
            .filter(queue => !existingRoles.includes(queue))
            .map(async roleToCreate =>
                await this.guild.roles.create(
                    {
                        name: roleToCreate,
                        position: 1,
                    }
                )));
    }

    // async hieararchyRolesAreCorrect(): Promise<boolean> {

    // }

    private async sendCommandHelpMessages(
        helpCategories: CategoryChannel[]
    ): Promise<void> {
        const allHelpChannels = helpCategories.flatMap(
            cat => [...cat.children.values()]
                .filter(ch => ch.type === "GUILD_TEXT") as TextChannel[]
        );

        if (helpCategories.length === 0 || allHelpChannels.length === 0) {
            console.warn("\x1b[31mNo help categories found.\x1b[0m");
            console.log(
                "Did you mean to call \x1b[32mupdateCommandHelpChannels()\x1b[0m?"
            );
            return;
        }

        // delete all existing messages
        await Promise.all(
            allHelpChannels.map(
                async ch => await ch.messages
                    .fetch()
                    .then(messages => messages.map(msg => msg.delete()))
            ));

        // now send new ones
        await Promise.all(
            allHelpChannels.map(async ch => {
                const file = Object.values(CommandChConfig).find(
                    val => val.channelName === ch.name
                )?.file;
                if (file) { await ch.send(SimpleEmbed(file)); }
            }));
    }
}

export { AttendingServerV2, QueueChannel };
