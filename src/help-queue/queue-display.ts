/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-expect-error the ascii table lib has no type
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
import { QueueViewModel } from './help-queue';
import { QueueChannel } from '../attending-server/base-attending-server';
import {
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    User
} from 'discord.js';


// The only responsibility is to interface with the ascii table
class QueueDisplayV2 {

    constructor(
        private readonly queueChannel: QueueChannel,
        private readonly user: User
    ) { }

    // TODO: Extract notif button as extension
    async render(queue: QueueViewModel, sendNew = false): Promise<void> {
        const embedTableMsg = new MessageEmbed();
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
                    // .setDisabled(queue.isOpen) // is this required?
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

        embedTableMsg.setTitle(`Queue for ${queue.name} is\t**${queue.isOpen ? "✓ OPEN" : "✕ CLOSED"}**`)
            .setDescription(this.composeAsciiTable(queue));

        // Trigger onRenderMessageCreate() here

        const queueMessages = await this.queueChannel
            .channelObject
            .messages
            .fetch();

        // If YABOB's message is not the first one, abort render
        // prompt user to call enclosing queue's cleanUpQueueChannel() method
        if (!sendNew && (queueMessages.size !== 1 ||
            queueMessages.first()?.author.id !== this.user.id)) {
            console.warn('The queue has messages not from YABOB. '
                + `Use the /cleanup ${this.queueChannel.queueName} command `
                + 'to clean up the channel');
            return;
        }

        if (sendNew) {
            await this.queueChannel.channelObject.send({
                embeds: [embedTableMsg],
                components: [joinLeaveButtons, notifButtons]
            });
        } else {
            await this.queueChannel.channelObject.messages.cache.first()?.edit({
                embeds: [embedTableMsg],
                components: [joinLeaveButtons, notifButtons]
            });
        }

        // Trigger onRenderMessageSent() here
    }

    composeAsciiTable(queue: QueueViewModel): string {
        if (queue.studentIDs.length === 0) {
            return "";
        }
        const table = new AsciiTable3();
        table.setHeading('Position', 'Student Name')
            .setAlign(1, AlignmentEnum.CENTER)
            .setAlign(2, AlignmentEnum.CENTER)
            .addRowMatrix([...queue.studentIDs
                .map((name, idx) => [idx === 0 ? `(☞°∀°)☞` : `${idx + 1}`, name])
            ])
            .setStyle('unicode-mix');
        return "```" + table.toString() + "```";
    }
}

export { QueueDisplayV2 };