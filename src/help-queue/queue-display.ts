/** @module HelpQueueV2 */
// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { QueueViewModel } from './help-queue.js';
import { QueueChannel } from '../attending-server/base-attending-server.js';
import {
    Collection,
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    BaseMessageOptions,
    User,
    ButtonStyle
} from 'discord.js';
import { EmbedColor } from '../utils/embed-helper.js';
import { RenderIndex, MessageId } from '../utils/type-aliases.js';

/**
 * Class that handles the rendering of the queue, i.e. displaying and updating
 * the queue embeds
 */
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
            /** Actual embed content */
            contents: Pick<BaseMessageOptions, 'embeds' | 'components'>;
            /** the order of the embed */
            renderIndex: RenderIndex;
            /** whether it has already been rendered */
            stale: boolean;
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
     * Saved for queue delete. Stop the timer when a queue is deleted.
     */
    private isRendering = false;
    /**
     * Saved for queue delete. Stop the timer when a queue is deleted.
     */
    renderLoopTimerId: NodeJS.Timeout;

    constructor(
        private readonly user: User,
        private readonly queueChannel: QueueChannel
    ) {
        /** starts the render loop */
        this.renderLoopTimerId = setInterval(async () => {
            if (
                this.queueChannelEmbeds.filter(embed => !embed.stale).size !== 0 &&
                !this.isRendering
            ) {
                console.log('render triggered');
                await this.render();
                this.queueChannelEmbeds.map(embed => (embed.stale = true));
            }
        }, 1000);
    }

    /**
     * Request a render of the main queue embed (queue list + active helper list)
     * @param queue
     */
    requestQueueRender(queue: QueueViewModel): void {
        const embedTableMsg = new EmbedBuilder();
        embedTableMsg
            .setTitle(
                `Queue for [${queue.queueName}] is ${
                    queue.seriousModeEnabled
                        ? queue.isOpen
                            ? '**__OPEN__**'
                            : '**__CLOSED__**'
                        : queue.isOpen
                        ? '**__OPEN__**\t(ﾟ∀ﾟ )'
                        : '**__CLOSED__**\t◦<(¦3[___]'
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
                .setDescription(
                    queue.helperIDs
                        .map(id => {
                            const voiceChannel =
                                this.queueChannel.channelObj.guild.voiceStates.cache.get(
                                    id
                                )?.channel;
                            const vcStatus = voiceChannel
                                ? voiceChannel.members.size > 1
                                    ? `Busy in [${voiceChannel.name}]`
                                    : `Idling in [${voiceChannel.name}]`
                                : 'Not in voice channel.';
                            return `<@${id}>\t|\t**${vcStatus}**`;
                        })
                        .join('\n')
                )
                .setColor(EmbedColor.Aqua);
            embedList.push(helperList);
        }
        this.queueChannelEmbeds.set(0, {
            contents: {
                embeds: embedList,
                components: [joinLeaveButtons, notifButtons]
            },
            renderIndex: 0,
            stale: false
        });
    }

    /**
     * Request a render of a non-queue (not the main queue list) embed
     * @param embedElements
     * @param renderIndex
     */
    requestNonQueueEmbedRender(
        embedElements: Pick<BaseMessageOptions, 'embeds' | 'components'>,
        renderIndex: number
    ): void {
        this.queueChannelEmbeds.set(renderIndex, {
            contents: embedElements,
            renderIndex: renderIndex,
            stale: false
        });
    }

    /**
     * Render the embeds in the queueChannelEmbeds collection into the queue channel
     */
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

    /**
     * Create an ascii table of the queue
     * @param queue
     * @returns the ascii table as a `string` in a code block
     */
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
                        queue.seriousModeEnabled
                            ? idx + 1
                            : idx === 0
                            ? `(☞°∀°)☞ 1`
                            : `${idx + 1}`,
                        name
                    ])
                ]);
        } else {
            const rand = Math.random();
            table
                .addRow('This Queue is Empty.')
                .setAlign(1, AlignmentEnum.CENTER)
                .setStyle('unicode-mix');
            if (!queue.seriousModeEnabled) {
                if (rand <= 0.1) {
                    table.addRow(`=^ Φ ω Φ ^=`);
                } else if (rand <= 0.3 && rand >= 0.11) {
                    table.addRow(`Did you find the cat?`);
                }
            }
        }
        return '```' + table.toString() + '```';
    }
}

export { QueueDisplayV2 };
