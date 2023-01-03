/** @module SessionCalendar */
import { BaseQueueExtension } from '../extension-interface.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { EmbedColor } from '../../utils/embed-helper.js';
import { red } from '../../utils/command-line-colors.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { QueueChannel } from '../../attending-server/base-attending-server.js';
import {
    composeUpcomingSessionsEmbedBody,
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
        private readonly queueChannel: QueueChannel,
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
        const state = CalendarExtensionState.allStates.get(queueChannel.channelObj.guild.id);
        if (state === undefined) {
            throw new ExtensionSetupError(
                red('The interaction level extension is required.')
            );
        }
        const instance = new CalendarQueueExtension(renderIndex, queueChannel, display);
        state.queueExtensions.set(queueChannel.queueName, instance);
        return instance;
    }

    /**
     * Embeds the upcoming hours into the queue channel
     */
    override async onQueueRender(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        queue: FrozenQueue,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        display: FrozenDisplay
    ): Promise<void> {
        await this.renderCalendarEmbeds();
    }

    /**
     * Removes `deletedQueue` from the listeners map
     * @param deletedQueue
     */
    override async onQueueDelete(deletedQueue: FrozenQueue): Promise<void> {
        CalendarExtensionState.allStates
            .get(this.queueChannel.channelObj.guild.id)
            ?.queueExtensions.delete(deletedQueue.queueName);
        // now garbage collector should clean up this instance
        // when server deletes the queue from queue collection
    }

    /**
     * Event listener/subscriber for changes in calendarExtensionStates
     */
    async onCalendarStateChange(): Promise<void> {
        await this.renderCalendarEmbeds();
    }

    /**
     * Composes the calendar embed and sends a render request to the display
     * @param refreshCache whether to refresh the upcomingSessions cache
     */
    private async renderCalendarEmbeds(): Promise<void> {
        const state = CalendarExtensionState.allStates.get(
            this.queueChannel.channelObj.guild.id
        );
        if (!state) {
            return;
        }
        const queueName = this.queueChannel.queueName;
        const upcomingSessionsEmbed = new EmbedBuilder()
            .setTitle(`Upcoming Sessions for ${queueName}`)
            .setDescription(
                composeUpcomingSessionsEmbedBody(
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
                this.queueChannel.channelObj.guildId,
                this.queueChannel.channelObj.id
            ])
                .setEmoji('🔄')
                .setLabel('Refresh Upcoming Sessions')
                .setStyle(ButtonStyle.Secondary)
        );
        this.display.requestNonQueueEmbedRender(
            {
                embeds: [upcomingSessionsEmbed],
                components: [buttons]
            },
            this.renderIndex
        );
    }
}

export { CalendarQueueExtension };
