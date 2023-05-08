/** @module HelpQueueV2 */
// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { QueueState, QueueViewModel } from './help-queue.js';
import { QueueChannel } from '../attending-server/base-attending-server.js';
import {
    Collection,
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    BaseMessageOptions,
    ButtonStyle,
    Snowflake
} from 'discord.js';
import { EmbedColor } from '../utils/embed-helper.js';
import { RenderIndex, MessageId } from '../utils/type-aliases.js';
import { client } from '../global-states.js';
import { buildComponent } from '../utils/component-id-factory.js';
import { ButtonNames } from '../interaction-handling/interaction-constants/interaction-names.js';
import { red } from '../utils/command-line-colors.js';

/** Wrapper for discord embeds to be sent to the queue */
type QueueChannelEmbed = {
    /** Actual embed content */
    contents: Pick<BaseMessageOptions, 'embeds' | 'components'>;
    /** the order of the embed. @example renderIndex = 1 is the 2nd embed */
    renderIndex: RenderIndex;
    /** whether it has already been rendered */
    stale: boolean;
};

/** Styled text for different queue states */
const queueStateStyles: {
    [K in QueueState]: {
        color: EmbedColor;
        statusText: { serious: string; notSerious: string };
    };
} = {
    // colors are arbitrary, feel free to change these
    closed: {
        color: EmbedColor.PastelPurple,
        statusText: {
            serious: '**CLOSED**',
            notSerious: '**CLOSED**\t◦<(¦3[___]⋆｡˚✩'
        }
    },
    open: {
        color: EmbedColor.Aqua,
        statusText: {
            serious: '**OPEN**',
            notSerious: '**OPEN**\t(ﾟ∀ﾟ )'
        }
    },
    paused: {
        color: EmbedColor.Yellow,
        statusText: {
            serious: '**PAUSED**',
            notSerious: '**PAUSED**\t(´∀` )'
        }
    }
};

/**
 * Class that handles the rendering of the queue
 * i.e. displaying and updating the queue embeds
 */
class QueueDisplayV2 {
    /**
     * The collection of message ids that are safe to edit
     * - binds the render index with a specific message
     * - if the message doesn't exist, send and re-bind. Avoids the unknown message issue
     */
    private embedMessageIdMap: Collection<RenderIndex, MessageId> = new Collection();
    /**
     * The mutex that locks the render method during render
     * - avoids the message.delete method from being called on a deleted message
     * - queue and extensions can still request render and write to queueChannelEmbeds
     */
    private isRendering = false;
    /**
     * The collection of actual embeds. key is render index
     * - queue has render index 0
     * - immediately updated in both requestQueueRender and requestNonQueueEmbedRender
     */
    private queueChannelEmbeds: Collection<RenderIndex, QueueChannelEmbed> =
        new Collection();
    /**
     * Whether the display has temporarily paused rendering
     */
    private writeOnlyMode = false;

    /**
     * Saved for queue delete. Stop the timer when a queue is deleted.
     */
    readonly renderLoopTimerId: NodeJS.Timeout;

    constructor(private readonly queueChannel: QueueChannel) {
        // starts the render loop
        this.renderLoopTimerId = setInterval(async () => {
            // every second, check if there are any fresh embeds
            // if there's nothing new or a render is already happening, stop
            if (
                this.isRendering ||
                this.writeOnlyMode ||
                this.queueChannelEmbeds.filter(embed => !embed.stale).size === 0
            ) {
                return;
            }
            this.render()
                .then(() => {
                    this.queueChannelEmbeds.forEach(embed => (embed.stale = true));
                })
                .catch(err => {
                    console.error(
                        red(`Failed to render in ${this.queueChannel.queueName}`),
                        err
                    ); // don't change embed.stale to true so we can try again after 1 second
                    // this line is technically not necessary but it's nice and symmetric
                    this.queueChannelEmbeds.forEach(embed => (embed.stale = false));
                });
        }, 1000);
    }

    /**
     * Lets the display enter write only mode.
     * When enabled, the render loop will skip rendering even if non-stale embeds exist
     */
    enterWriteOnlyMode(): void {
        this.writeOnlyMode = true;
    }

    /**
     * Exits the write only mode.
     */
    exitWriteOnlyMode(): void {
        this.queueChannelEmbeds.forEach(embed => (embed.stale = false));
        this.writeOnlyMode = false;
    }

    /**
     * Requests a force render of all embeds
     */
    async requestForceRender(): Promise<void> {
        await this.render(true);
    }

    /**
     * Request a render of embeds from extensions
     * @param embedElements the embeds to render
     * @param renderIndex the index given by HelpQueueV2
     */
    requestExtensionEmbedRender(
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
     * Request a render of the main queue embed (queue list + active helper list)
     * @param viewModel
     */
    requestQueueEmbedRender(viewModel: QueueViewModel): void {
        const embedTableMsg = new EmbedBuilder();
        embedTableMsg
            .setTitle(
                `Queue for〚 ${viewModel.queueName} 〛is ${
                    queueStateStyles[viewModel.state].statusText[
                        viewModel.seriousModeEnabled ? 'serious' : 'notSerious'
                    ]
                }`
            )
            .setDescription(this.composeQueueAsciiTable(viewModel))
            .setColor(queueStateStyles[viewModel.state].color);
        if (
            viewModel.timeUntilAutoClear !== 'AUTO_CLEAR_DISABLED' &&
            viewModel.state === 'closed' &&
            viewModel.studentDisplayNames.length !== 0
        ) {
            embedTableMsg.addFields({
                name: 'Auto Clear',
                value: `This queue will be cleared <t:${Math.floor(
                    viewModel.timeUntilAutoClear.getTime() / 1000
                )}:R>`
            });
        }
        if (viewModel.state === 'paused') {
            // this message is optional, if the queue embed takes up too much screen remove this first
            embedTableMsg.addFields({
                name: 'Paused Queue',
                value: `All helpers of this queue have paused new students from joining.
                If you are already in the queue, helpers can still dequeue you.`
            });
        }
        const joinLeaveButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            buildComponent(new ButtonBuilder(), [
                'queue',
                ButtonNames.Join,
                this.queueChannel.channelObj.guild.id,
                this.queueChannel.channelObj.id
            ])
                .setEmoji('✅')
                .setDisabled(viewModel.state !== 'open')
                .setLabel('Join')
                .setStyle(ButtonStyle.Success),
            buildComponent(new ButtonBuilder(), [
                'queue',
                ButtonNames.Leave,
                this.queueChannel.channelObj.guild.id,
                this.queueChannel.channelObj.id
            ])
                .setEmoji('❎')
                .setLabel('Leave')
                .setStyle(ButtonStyle.Danger)
        );
        const notifButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            buildComponent(new ButtonBuilder(), [
                'queue',
                ButtonNames.Notif,
                this.queueChannel.channelObj.guild.id,
                this.queueChannel.channelObj.id
            ])
                .setEmoji('🔔')
                .setLabel('Notify When Open')
                .setStyle(ButtonStyle.Primary),
            buildComponent(new ButtonBuilder(), [
                'queue',
                ButtonNames.RemoveNotif,
                this.queueChannel.channelObj.guild.id,
                this.queueChannel.channelObj.id
            ])
                .setEmoji('🔕')
                .setLabel('Remove Notifications')
                .setStyle(ButtonStyle.Primary)
        );
        const embedList = [embedTableMsg];
        const getVcStatus = (helperId: Snowflake) => {
            const spacer = '\u3000'; // ideographic space character, extra wide
            const voiceChannel =
                this.queueChannel.channelObj.guild.voiceStates.cache.get(
                    helperId
                )?.channel;
            // using # gives the same effect as if we use the id
            // bc students can't see the channel ping if they don't have permission
            const vcStatus = voiceChannel
                ? voiceChannel.members.size > 1
                    ? `Busy in #${voiceChannel.name}`
                    : `Idling in #${voiceChannel.name}`
                : 'Not in voice channel.';
            return `<@${helperId}>${spacer}${vcStatus}`;
        };
        if (viewModel.activeHelperIDs.length + viewModel.pausedHelperIDs.length > 0) {
            const helperList = new EmbedBuilder();
            helperList
                .setTitle('Currently Available Helpers and Voice Channel Status')
                .setColor(queueStateStyles[viewModel.state].color);
            if (viewModel.activeHelperIDs.length > 0) {
                helperList.addFields({
                    name: 'Active Helpers',
                    value: viewModel.activeHelperIDs.map(getVcStatus).join('\n')
                });
            }
            if (viewModel.pausedHelperIDs.length > 0) {
                helperList.addFields({
                    name: 'Paused Helpers',
                    value: viewModel.pausedHelperIDs.map(getVcStatus).join('\n')
                });
            }
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
     * Create an ascii table of the queue
     * @param viewModel the data to put into the table
     * @returns the ascii table as a `string` in a code block
     */
    private composeQueueAsciiTable(viewModel: QueueViewModel): string {
        const table = new AsciiTable3();
        if (viewModel.studentDisplayNames.length > 0) {
            table
                .setHeading('Position', 'Student Name')
                .setAlign(1, AlignmentEnum.CENTER)
                .setAlign(2, AlignmentEnum.CENTER)
                .setStyle('unicode-single')
                .addRowMatrix([
                    ...viewModel.studentDisplayNames.map((name, idx) => [
                        idx === 0
                            ? viewModel.seriousModeEnabled
                                ? '1 (Up Next)'
                                : '(☞°∀°)☞ Up Next!'
                            : idx + 1,
                        name
                    ])
                ]);
        } else {
            const rand = Math.random();
            table
                .addRow('This queue is empty.')
                .setAlign(1, AlignmentEnum.CENTER)
                .setStyle('unicode-single');
            if (!viewModel.seriousModeEnabled) {
                if (rand <= 0.1) {
                    table.addRow('=^ Φ ω Φ ^=');
                } else if (rand <= 0.3 && rand >= 0.11) {
                    table.addRow('Did you find the cat?');
                }
            }
        }
        return '```\n' + table.toString() + '\n```';
    }

    /**
     * Render the embeds in the queueChannelEmbeds collection into the queue channel
     * @param force whether to override current render strategy and do a fresh render
     */
    private async render(force = false): Promise<void> {
        this.isRendering = true;
        const queueChannelExists = this.queueChannel.channelObj.guild.channels.cache.has(
            this.queueChannel.channelObj.id
        );
        if (!queueChannelExists) {
            // temporary fix, do nothing if #queue doesn't exist
            this.isRendering = false;
            return;
        }
        const [yabobMessages, nonYabobMessages] = (
            await this.queueChannel.channelObj.messages.fetch({ cache: false })
        ).partition(msg => msg.author.id === client.user.id);
        const existingEmbeds = yabobMessages.filter(msg =>
            this.embedMessageIdMap.some(id => id === msg.id)
        );
        // all required messages exist and there are no other messages
        const safeToEdit =
            existingEmbeds.size === this.queueChannelEmbeds.size &&
            nonYabobMessages.size === 0;
        if (!safeToEdit || force) {
            const allMessages = await this.queueChannel.channelObj.messages.fetch();
            await Promise.all(allMessages.map(msg => msg.delete()));
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
}

export { QueueDisplayV2 };
