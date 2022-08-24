// V2 of attending server
import {
    CategoryChannel,
    Client,
    Guild,
    GuildChannel,
    Role,
    TextChannel,
    User,
    Collection,
    GuildMember,
    Channel,
} from "discord.js";
import { HelpQueue, HelpQueueDisplayManager } from "../queue";
import { MemberStateManager } from "../member_state_manager";
import { UserError } from "../user_action_error";
import { MemberState } from "../member_state_manager";

import { EmbedColor, SimpleEmbed } from "../embed_helper";
import { Firestore } from "firebase-admin/firestore";

// Wrapper for TextChannel
// Guarantees that a queue_name exists
type QueueChannel = {
    channelObject: TextChannel;
    queueName: string;
};

class AttendingServerV2 {
    private queues: HelpQueue[] = [];

    private constructor(
        private user: User,
        private guild: Guild,
        private firebaseDB: Firestore,
        private memberStates = new MemberStateManager()
    ) { }

    /**
     * **Asynchronously creates a YABOB instance for 1 server**
     *
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
        if (server.me === null || !server.me.permissions.has("ADMINISTRATOR")) {
            const owner = await server.fetchOwner();
            await owner.send(
                SimpleEmbed(
                    `Sorry. I need full administrator permission to join and manage "${server.name}"`,
                    EmbedColor.Error
                )
            );
            await server.leave();
            throw new UserError("YABOB doesn't have admin permission.");
        }

        console.log(`Creating new YABOB for server: ${server.name}`);
        const me = new AttendingServerV2(user, server, firebaseDB);

        return me;
    }

    /**
     * Gets all the queue channels on the server
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
                        child.name === "queue" &&
                        child.type === "GUILD_TEXT"
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
        const existingHelpCh = allChannels
            .filter(
                ch =>
                    ch.type === "GUILD_CATEGORY" &&
                    ch.name === "Bot Commands Help"
            )
            .map(ch => ch as CategoryChannel);

        if (existingHelpCh.length === 0) {
            console.log("Creating new help channels");
            const helpCategory = await this.guild.channels.create(
                "Bot Commands Help",
                { type: "GUILD_CATEGORY" }
            );

            const adminCommandCh = await helpCategory.createChannel(
                "admin-commands"
            );
            await adminCommandCh.permissionOverwrites.create(
                this.guild.roles.everyone,
                { SEND_MESSAGES: false }
            );
            await adminCommandCh.permissionOverwrites.create(
                this.user,
                { SEND_MESSAGES: true }
            );

        }
    }
}

export { AttendingServerV2, QueueChannel };
