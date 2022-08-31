// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { QueueViewModel } from './help-queue';
import { QueueChannel } from '../attending-server/base-attending-server';
import {
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    MessageOptions,
    User
} from 'discord.js';
import { QueueRenderError } from '../utils/error-types';
import { EmbedColor } from '../utils/embed-helper';

// The only responsibility is to interface with the ascii table
class QueueDisplayV2 {

    // Key is renderIndex, Value is ready or not
    // If nonQueueEmbedReadyState[renderIndex] is true, then it's safe to edit
    private nonQueueEmbedReadyStates = new Map<number, boolean>();

    constructor(
        private readonly user: User,
        private readonly queueChannel: QueueChannel,
    ) { }

    async renderQueue(queue: QueueViewModel, sendNew = false): Promise<void> {
        const queueMessages = await this.queueChannel
            .channelObj
            .messages
            .fetch();

        // If YABOB's message is not the first one, reject
        if (!sendNew && queueMessages.first()?.author.id !== this.user.id) {
            return Promise.reject(new QueueRenderError(
                'This queue is not safe to re-render. '
                + `Use the /cleanup ${this.queueChannel.queueName} command `
                + 'to clean up the channel',
                this.queueChannel.queueName
            ));
        }

        const embedTableMsg = new MessageEmbed();
        embedTableMsg
            .setTitle(`Queue for〚${queue.name}〛is\t${queue.isOpen
                ? "**OPEN**\n(･`ω´・)"
                : "**CLOSED**\n◦<(¦3[▓▓]⋆｡˚"}`)
            .setDescription(this.composeAsciiTable(queue))
            .setColor(EmbedColor.NoColor);

        const joinLeaveButtons = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("join " + queue.name)
                    .setEmoji("✅")
                    .setDisabled(!queue.isOpen)
                    .setLabel("Join")
                    .setStyle("SUCCESS")
            )
            .addComponents(
                new MessageButton()
                    .setCustomId("leave " + queue.name)
                    .setEmoji("❎")
                    .setDisabled(!queue.isOpen)
                    .setLabel("Leave")
                    .setStyle("DANGER")
            );
        const notifButtons = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("notif " + queue.name)
                    .setEmoji("🔔")
                    .setLabel("Notify When Open")
                    .setStyle("PRIMARY")
            )
            .addComponents(
                new MessageButton()
                    .setCustomId("removeN " + queue.name)
                    .setEmoji("🔕")
                    // .setDisabled(queue.isOpen)
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

        if (sendNew) {
            await this.queueChannel.channelObj.send({
                embeds: embedList,
                components: [joinLeaveButtons, notifButtons]
            });
        } else {
            await this.queueChannel.channelObj.messages.cache.first()?.edit({
                embeds: embedList,
                components: [joinLeaveButtons, notifButtons]
            });
        }
    }

    async renderNonQueueEmbeds(
        embeds: Pick<MessageOptions, "embeds">,
        renderIndex: number,
        cleanUp = false
    ): Promise<void> {
        const queueMessages = await this.queueChannel
            .channelObj
            .messages
            .fetch();

        // see if the embed is already sent (ready)
        // if not ready or non existent, send a new one
        const sendNew = (!this.nonQueueEmbedReadyStates.get(renderIndex) ?? true) || cleanUp;

        // if the message at renderIndex is not from YABOB, reject and let HelpQueueV2 call cleanup
        if (!sendNew &&
            queueMessages.first(renderIndex + 1)[renderIndex]?.author.id !== this.user.id) {
            return Promise.reject(new QueueRenderError(
                'This queue is not safe to re-render.',
                this.queueChannel.queueName
            ));
        }

        if (sendNew) {
            await this.queueChannel.channelObj.send(embeds);
            this.nonQueueEmbedReadyStates.set(renderIndex, true);
        } else {
            await this.queueChannel.channelObj.messages.cache
                .first(renderIndex + 1)[renderIndex]
                ?.edit(embeds);
        }
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
            table.addRow('This Queue is Empty.')
                .addRow(`${Math.random() < 0.3 ? "=^ Φ ω Φ ^=" : "Did you find the cat?"}`)
                .setAlign(1, AlignmentEnum.CENTER)
                .setStyle('unicode-mix');
        }

        return "```" + table.toString() + "```";
    }
}

export { QueueDisplayV2 };