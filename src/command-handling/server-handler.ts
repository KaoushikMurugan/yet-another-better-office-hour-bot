import { GuildMember, TextChannel } from "discord.js";
import { AttendingServerV2, QueueChannel } from "../attending-server/base-attending-server";


class ServerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ServerError";
    }
}

class ServerCommandHandler {

    constructor(private server: AttendingServerV2) { }

    async createQueue(queueName: string): Promise<void> {
        const existingQueues = await this.server.getQueueChannels();

        // creation logic

        return new Promise<void>((resolve, reject) => {
            const existQueueWithSameName = existingQueues
                .find(q => q.queueName === queueName)
                !== undefined;
            if (existQueueWithSameName) {
                reject(new ServerError(`Queue ${queueName} already exists`));
            }

            resolve();
        });
    }

    async deleteQueue(queueChannel: TextChannel): Promise<void> {
        const queueExists = (await this.server.getQueueChannels())
            .find(queue => queue.channelObject.id === queueChannel.id);

        // deletion logic

        return new Promise<void>((resolve, reject) => {
            if (!queueExists) {
                reject(new ServerError(`Queue ${queueChannel.name} is not a queue`));
            }
            resolve();
        });
    }

    // async enqueue(user: GuildMember, queue: QueueChannel): Promise<void> {
        
    // }


}

export { ServerCommandHandler, ServerError };