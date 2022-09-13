// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { QueueViewModel } from './help-queue';
import { QueueChannel } from '../attending-server/base-attending-server';
import {
    Collection,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    MessageOptions,
    User
} from 'discord.js';
import { EmbedColor } from '../utils/embed-helper';

// The only responsibility is to interface with the ascii table
class QueueDisplayV2 {

    /**
     * keeps track of the actual embeds, key is render index
     * - queue has render index 0
     * - immediately updated in both requestQueueRender and requestNonQueueEmbedRender
    */
    private queueChannelEmbeds
        = new Collection<number, Pick<MessageOptions, 'embeds' | 'components'>>();
    /**
     * lock any edits during cleanup
     * - there's a short timeframe where the channel has 0 messages
     * - any edits during that time will throw unknown message api error
    */
    private isCleaningUp = false;

    constructor(
        private readonly user: User,
        private readonly queueChannel: QueueChannel,
    ) { }

    async requestQueueRender(queue: QueueViewModel): Promise<void> {
        const embedTableMsg = new MessageEmbed();
        embedTableMsg
            .setTitle(`Queue for〚${queue.queueName}〛is\t${queue.isOpen
                ? "**OPEN**\t (ﾟ∀ﾟ )"
                : "**CLOSED**\t ◦<(¦3[▓▓]"}`)
            .setDescription(this.composeAsciiTable(queue))
            .setColor(queue.isOpen ? EmbedColor.Aqua : EmbedColor.Purple1);
        const joinLeaveButtons = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("join " + queue.queueName)
                    .setEmoji("✅")
                    .setDisabled(!queue.isOpen)
                    .setLabel("Join")
                    .setStyle("SUCCESS")
            )
            .addComponents(
                new MessageButton()
                    .setCustomId("leave " + queue.queueName)
                    .setEmoji("❎")
                    .setDisabled(!queue.isOpen)
                    .setLabel("Leave")
                    .setStyle("DANGER")
            );
        const notifButtons = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("notif " + queue.queueName)
                    .setEmoji("🔔")
                    .setLabel("Notify When Open")
                    .setStyle("PRIMARY")
            )
            .addComponents(
                new MessageButton()
                    .setCustomId("removeN " + queue.queueName)
                    .setEmoji("🔕")
                    .setLabel("Remove Notifications")
                    .setStyle("PRIMARY")
            );
        const embedList = [embedTableMsg];
        if (queue.helperIDs.length !== 0) {
            const helperList = new MessageEmbed();
            helperList
                .setTitle(`Currently available helpers`)
                .setDescription(queue.helperIDs.join('\n'));
            embedList.push(helperList);
        }
        this.queueChannelEmbeds.set(0, {
            embeds: embedList,
            components: [joinLeaveButtons, notifButtons]
        });
        if (!this.queueChannel.channelObj.guild.channels.cache
            .has(this.queueChannel.channelObj.id)) {
            // temporary fix, do nothing if #queue doesn't exist
            return;
        }
        const queueMessages = await this.queueChannel
            .channelObj
            .messages
            .fetch();
        const YABOBMessages = queueMessages.filter(msg => msg.author.id === this.user.id);
        // If the channel doesn't have exactly all YABOB messages and the right amount, cleanup
        const messageCountMatch = YABOBMessages.size === queueMessages.size &&
            queueMessages.size === this.queueChannelEmbeds.size;
        if (!messageCountMatch) {
            await this.cleanupRender();
            return; // return here or we get cache mismatch
        }
        if (!this.isCleaningUp) {
            await this.queueChannel.channelObj.messages.cache.at(0)?.edit({
                embeds: embedList,
                components: [joinLeaveButtons, notifButtons]
            });
        }
    }

    async requestNonQueueEmbedRender(
        embedElements: Pick<MessageOptions, 'embeds' | 'components'>,
        renderIndex: number
    ): Promise<void> {
        this.queueChannelEmbeds.set(renderIndex, embedElements);
        if (!this.queueChannel.channelObj.guild.channels.cache
            .has(this.queueChannel.channelObj.id)) {
            // temporary fix, do nothing if #queue doesn't exist
            return;
        }
        const queueMessages = await this.queueChannel
            .channelObj
            .messages
            .fetch();
        const YABOBMessages = queueMessages.filter(msg => msg.author.id === this.user.id);
        const messageCountMatch = YABOBMessages.size === queueMessages.size &&
            queueMessages.size === this.queueChannelEmbeds.size;
        if (!messageCountMatch) {
            await this.cleanupRender();
            return;
        }
        if (!this.isCleaningUp) {
            await this.queueChannel.channelObj.messages.cache
                .at(renderIndex)
                ?.edit(embedElements);
        }
    }

    private async cleanupRender(): Promise<void> {
        this.isCleaningUp = true;
        await Promise.all((await this.queueChannel.channelObj.messages.fetch())
            .map(msg => msg.delete()));
        // sort by render index
        const sortedEmbeds = [...this.queueChannelEmbeds.entries()]
            .sort((embed1, embed2) => embed1[0] - embed2[0])
            .map(embed => embed[1]);
        // Cannot promise all here, contents need to be sent in order
        for (const content of sortedEmbeds) {
            await this.queueChannel.channelObj.send(content);
        }
        this.isCleaningUp = false;
    }

    private composeAsciiTable(queue: QueueViewModel): string {
        const table = new AsciiTable3();
        if (queue.studentDisplayNames.length > 0) {
            table.setHeading('Position', 'Student Name')
                .setAlign(1, AlignmentEnum.CENTER)
                .setAlign(2, AlignmentEnum.CENTER)
                .setStyle('unicode-mix')
                .addRowMatrix([...queue.studentDisplayNames
                    .map((name, idx) => [idx === 0 ? `(☞°∀°)☞ 1` : `${idx + 1}`, name])
                ]);
        } else {
            const rand = Math.random();
            table.addRow('This Queue is Empty.')
                .setAlign(1, AlignmentEnum.CENTER)
                .setStyle('unicode-mix');
            if (rand <= 0.1) {
                table.addRow(`=^ Φ ω Φ ^=`);
            } else if (rand <= 0.2) {
                table.addRow(`Did you find the cat?`);
            }
        }
        return "```" + table.toString() + "```";
    }
}

export { QueueDisplayV2 };