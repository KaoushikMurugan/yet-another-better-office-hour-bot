/** @module SessionCalendar */
import { BaseQueueExtension } from '../extension-interface.js';
import { EmbedColor } from '../../utils/embed-helper.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { QueueChannel } from '../../models/queue-channel.js';
import {
    buildUpcomingSessionsEmbedBody,
    restorePublicEmbedURL
} from './shared-calendar-functions.js';
import { FrozenDisplay, FrozenQueue } from '../extension-utils.js';
import { buildComponent } from '../../utils/component-id-factory.js';
import { CalendarButtonNames } from './calendar-constants/calendar-interaction-names.js';
import { RenderIndex } from '../../utils/type-aliases.js';
import { CalendarExtensionState } from './calendar-states.js';

/**
 * Calendar Extension for individual queues
 * ----
 * - All instances read from the calendar in CalendarExtensionStates.states
 * - Each instance only looks for the queue it's responsible for
 */
class CalendarQueueExtension extends BaseQueueExtension {
    /**
     * @param renderIndex the order in the embed list, given by HelpQueue
     * @param queueChannel the #queue text channel
     * @param display same display object as the queue
     */
    private constructor(
        private readonly renderIndex: RenderIndex,
        public queueChannel: QueueChannel,
        private readonly display: FrozenDisplay
    ) {
        super();
    }

    /**
     * Initializes the calendar extension
     * @param renderIndex the index of the embed message given by the queue
     * @param queueChannel channel object
     * @param display the display object,
     *  **same reference** as the display in the HelpQueue that this extension belongs to
     */
    static async load(
        renderIndex: RenderIndex,
        queueChannel: QueueChannel,
        display: FrozenDisplay
    ): Promise<CalendarQueueExtension> {
        const state = CalendarExtensionState.get(queueChannel.textChannel.guild.id);
        const instance = new CalendarQueueExtension(renderIndex, queueChannel, display);
        state.queueExtensions.set(queueChannel.queueName, instance);
        return instance;
    }

    /**
     * Event listener/subscriber for changes in calendarExtensionStates
     */
    onCalendarStateChange(): void {
        this.renderCalendarEmbeds();
    }

    /**
     * Send the embed on queue create
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override async onQueueCreate(queue: FrozenQueue): Promise<void> {
        this.renderCalendarEmbeds();
    }

    /**
     * Removes `deletedQueue` from the listeners map
     * @param deletedQueue
     */
    override async onQueueDelete(deletedQueue: FrozenQueue): Promise<void> {
        CalendarExtensionState.get(
            this.queueChannel.textChannel.guild.id
        ).queueExtensions.delete(deletedQueue.queueName);
    }

    /**
     * Composes the calendar embed and sends a render request to the display
     * @param refreshCache whether to refresh the upcomingSessions cache
     */
    private renderCalendarEmbeds(): void {
        const state = CalendarExtensionState.get(this.queueChannel.textChannel.guild.id);
        const queueName = this.queueChannel.queueName;
        const upcomingSessionsEmbed = new EmbedBuilder()
            .setTitle(`Upcoming Sessions for ${queueName}`)
            .setDescription(
                buildUpcomingSessionsEmbedBody(
                    state.upcomingSessions.filter(
                        viewModel => viewModel.queueName === queueName
                    ),
                    this.queueChannel.queueName,
                    state.lastUpdatedTimeStamp
                )
            )
            .setColor(EmbedColor.Blue)
            .setFooter({
                text: 'This embed shows up to 5 most recent sessions and auto refreshes every hour. ',
                iconURL: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/2048px-Google_Calendar_icon_%282020%29.svg.png`
            });
        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setURL(
                    state.publicCalendarEmbedUrl.length > 0
                        ? state.publicCalendarEmbedUrl
                        : restorePublicEmbedURL(state.calendarId)
                )
                .setEmoji('📅')
                .setLabel('Full Calendar')
                .setStyle(ButtonStyle.Link), // this method is required
            buildComponent(new ButtonBuilder(), [
                'queue',
                CalendarButtonNames.Refresh,
                this.queueChannel.textChannel.guildId
            ])
                .setEmoji('🔄')
                .setLabel('Refresh Upcoming Sessions')
                .setStyle(ButtonStyle.Secondary)
        );
        this.display.requestExtensionEmbedRender(
            {
                embeds: [upcomingSessionsEmbed],
                components: [buttons]
            },
            this.renderIndex
        );
    }
}

export { CalendarQueueExtension };
