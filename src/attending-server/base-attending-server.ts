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
import {
    GoogleSpreadsheet,
    GoogleSpreadsheetWorksheet,
} from "google-spreadsheet";
import gcs_creds from "../../gcs_service_account_key.json";
import fetch from "node-fetch";
import { EmbedColor, SimpleEmbed } from "../embed_helper";
import * as fs from "fs";
import { Firestore } from "firebase-admin/firestore";

type QueueChannel = {
    /**
     * Wrapper for TextChannel
     * Guarantees that a queue_name exists
     */
    channel_object: TextChannel;
    queue_name: string;
};

class AttendingServerV2 {
    private queues: HelpQueue[] = [];

    private constructor(
        private client: Client,
        private guild: Guild,
        private firebase_db: Firestore,
        private member_states = new MemberStateManager()
    ) {}

    /**
     * **Asynchronously creates a YABOB instance**
     *
     * @param client an instance of discord http client
     * @param server the server for YABOB to join
     * @param firebase_db firebase database object
     * @returns a created instance of YABOB
     * @throws UserError
     */
    static async create(
        client: Client,
        server: Guild,
        firebase_db: Firestore
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
        const me = new AttendingServerV2(client, server, firebase_db);
        const queue_channels = me.getQueueChannels();

        return me;
    }

    /**
     * Gets all the queue channels on the server
     * if nothing is found, returns empty array
     */
    async getQueueChannels(): Promise<QueueChannel[]> {
        // have to cast because ch has type 'AnyChannel'
        // type checking is done by ch.type so it's safe
        // same for channel as TextChannel
        // ch is channel
        const all_channels = await this.guild.channels.fetch();
        const queue_channels = all_channels
            .filter(ch => ch.type === "GUILD_CATEGORY")
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
                    channel_object: ch,
                    queue_name: name,
                } as QueueChannel;
            });

        const duplicate_queues = queue_channels
            .map(q => q.queue_name)
            .filter((item, index, arr) => arr.indexOf(item) !== index);

        if (duplicate_queues.length > 0) {
            console.warn(
                `The server "${this.guild.name}" contains these duplicate queues:`
            );
            console.warn(duplicate_queues);
            console.warn(
                `YABOB will still treat them as unique queues, but their names should be updated`
            );
        }

        return queue_channels;
    }


}

export { AttendingServerV2 };
