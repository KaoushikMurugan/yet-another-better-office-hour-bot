// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { QueueViewModel } from './help-queue';
import { QueueChannel } from '../attending-server/base-attending-server';
import {
    Collection,
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    BaseMessageOptions,
    User,
    ButtonStyle
} from 'discord.js';
import { EmbedColor } from '../utils/embed-helper';
import { RenderIndex, MessageId } from '../utils/type-aliases';

// The only responsibility is to interface with the ascii table
class QueueDisplayV2 {
    /**
     * keeps track of the actual embeds, key is render index
     * - queue has render index 0
     * - immediately updated in both requestQueueRender and requestNonQueueEmbedRender
     * - acts like a graphics card memory
     */
    private queueChannelEmbeds: Collection<
        RenderIndex,
        {
            contents: Pick<BaseMessageOptions, 'embeds' | 'components'>;
            renderIndex: RenderIndex;
        }
    > = new Collection();
    // key is renderIndex, value is message id
    // - binds the render index with a specific message
    // - if the message doesn't exist, send and re-bind. Avoids the unknown message issue
    private embedMessageIdMap: Collection<RenderIndex, MessageId> = new Collection();

    /**
     * lock the render method during render
     * - avoids the message.delete method from being called on a deleted message
     * - queue and extensions can still request render and write to queueChannelEmbeds
     */
    private isRendering = false;

    constructor(
        private readonly user: User,
        private readonly queueChannel: QueueChannel
    ) {}

    async requestQueueRender(queue: QueueViewModel): Promise<void> {
        const embedTableMsg = new EmbedBuilder();
        embedTableMsg
            .setTitle(
                `Queue for〚${queue.queueName}〛is\t${
                    queue.isOpen ? '**OPEN**\t(ﾟ∀ﾟ )' : '**CLOSED**\t◦<(¦3[___]'
                }`
            )
            .setDescription(this.composeQueueAsciiTable(queue))
            .setColor(queue.isOpen ? EmbedColor.Aqua : EmbedColor.Purple);
        const joinLeaveButtons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('join ' + queue.queueName)
                    .setEmoji('✅')
                    .setDisabled(!queue.isOpen)
                    .setLabel('Join')
                    .setStyle(ButtonStyle.Success)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('leave ' + queue.queueName)
                    .setEmoji('❎')
                    .setLabel('Leave')
                    .setStyle(ButtonStyle.Danger)
            );
        const notifButtons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('notif ' + queue.queueName)
                    .setEmoji('🔔')
                    .setLabel('Notify When Open')
                    .setStyle(ButtonStyle.Primary)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('removeN ' + queue.queueName)
                    .setEmoji('🔕')
                    .setLabel('Remove Notifications')
                    .setStyle(ButtonStyle.Primary)
            );
        const embedList = [embedTableMsg];
        if (queue.helperIDs.length !== 0) {
            const helperList = new EmbedBuilder();
            helperList
                .setTitle(`Currently available helpers`)
                .setDescription(queue.helperIDs.join('\n'))
                .setColor(EmbedColor.NoColor);
            embedList.push(helperList);
        }
        this.queueChannelEmbeds.set(0, {
            contents: {
                embeds: embedList,
                components: [joinLeaveButtons, notifButtons]
            },
            renderIndex: 0
        });
        !this.isRendering && (await this.render());
    }

    async requestNonQueueEmbedRender(
        embedElements: Pick<BaseMessageOptions, 'embeds' | 'components'>,
        renderIndex: number
    ): Promise<void> {
        this.queueChannelEmbeds.set(renderIndex, {
            contents: embedElements,
            renderIndex: renderIndex
        });
        !this.isRendering && (await this.render());
    }

    private async render(): Promise<void> {
        this.isRendering = true;
        if (
            !this.queueChannel.channelObj.guild.channels.cache.has(
                this.queueChannel.channelObj.id
            )
        ) {
            // temporary fix, do nothing if #queue doesn't exist
            return;
        }
        const queueMessages = this.queueChannel.channelObj.messages.cache;
        const [YABOBMessages, nonYABOBMessages] = queueMessages.partition(
            msg => msg.author.id === this.user.id
        );
        const existingEmbeds = YABOBMessages.filter(msg =>
            this.embedMessageIdMap.some(id => id === msg.id)
        );
        // all required messages exist and there are no other messages
        const safeToEdit =
            existingEmbeds.size === this.queueChannelEmbeds.size &&
            nonYABOBMessages.size === 0;
        if (!safeToEdit) {
            await Promise.all(
                (
                    await this.queueChannel.channelObj.messages.fetch(undefined)
                ).map(msg => msg.delete())
            );
            // sort by render index
            const sortedEmbeds = this.queueChannelEmbeds.sort(
                (embed1, embed2) => embed1.renderIndex - embed2.renderIndex
            );
            // Cannot promise all here, contents need to be sent in order
            for (const embed of sortedEmbeds.values()) {
                const newEmbedMessage = await this.queueChannel.channelObj.send(
                    embed.contents
                );
                this.embedMessageIdMap.set(embed.renderIndex, newEmbedMessage.id);
            }
        } else {
            await Promise.all(
                this.queueChannelEmbeds.map(embed =>
                    existingEmbeds
                        .get(this.embedMessageIdMap.get(embed.renderIndex) ?? '')
                        ?.edit(embed.contents)
                )
            );
        }
        this.isRendering = false;
    }

    private composeQueueAsciiTable(queue: QueueViewModel): string {
        const table = new AsciiTable3();
        if (queue.studentDisplayNames.length > 0) {
            table
                .setHeading('Position', 'Student Name')
                .setAlign(1, AlignmentEnum.CENTER)
                .setAlign(2, AlignmentEnum.CENTER)
                .setStyle('unicode-mix')
                .addRowMatrix([
                    ...queue.studentDisplayNames.map((name, idx) => [
                        idx === 0 ? `(☞°∀°)☞ 1` : `${idx + 1}`,
                        name
                    ])
                ]);
        } else {
            const rand = Math.random();
            table
                .addRow('This Queue is Empty.')
                .setAlign(1, AlignmentEnum.CENTER)
                .setStyle('unicode-mix');
            if (rand <= 0.1) {
                table.addRow(`=^ Φ ω Φ ^=`);
            } else if (rand <= 0.3 && rand >= 0.11) {
                table.addRow(`Did you find the cat?`);
            }
        }
        return '```' + table.toString() + '```';
    }
}

export { QueueDisplayV2 };
