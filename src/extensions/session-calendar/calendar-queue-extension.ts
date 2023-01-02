/** @module SessionCalendar */
import { BaseQueueExtension } from '../extension-interface.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { EmbedColor } from '../../utils/embed-helper.js';
import { red } from '../../utils/command-line-colors.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { QueueChannel } from '../../attending-server/base-attending-server.js';
import {
    composeUpcomingSessionsEmbedBody,
    getUpComingTutoringEvents,
    restorePublicEmbedURL,
    UpComingSessionViewModel
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
 * - Each instance only looks for the class it's responsible for
 */
class CalendarQueueExtension extends BaseQueueExtension {
    private upcomingSessions: UpComingSessionViewModel[] = [];
    private lastUpdatedTimeStamp = new Date();

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
        if (!CalendarExtensionState.states.has(queueChannel.channelObj.guild.id)) {
            throw new ExtensionSetupError(
                red('The interaction level extension is required.')
            );
        }
        const instance = new CalendarQueueExtension(renderIndex, queueChannel, display);
        CalendarExtensionState.states
            .get(queueChannel.channelObj.guild.id)
            ?.queueExtensions.set(queueChannel.queueName, instance);
        return instance;
    }

    /**
     * Every time queue emits onQueuePeriodicUpdate,
     * fetch new events and update cached viewModel
     */
    override async onQueuePeriodicUpdate(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        queue: FrozenQueue,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        isFirstCall: boolean
    ): Promise<void> {
        await this.renderCalendarEmbeds(true);
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
        await this.renderCalendarEmbeds(false);
    }

    /**
     * Removes `deletedQueue` from the listeners map
     * @param deletedQueue
     */
    override async onQueueDelete(deletedQueue: FrozenQueue): Promise<void> {
        CalendarExtensionState.states
            .get(this.queueChannel.channelObj.guild.id)
            ?.queueExtensions.delete(deletedQueue.queueName);
        // now garbage collector should clean up this instance
        // when server deletes the queue from queue collection
    }

    /**
     * Event listener/subscriber for changes in calendarExtensionStates
     */
    async onCalendarStateChange(): Promise<void> {
        await this.renderCalendarEmbeds(true);
    }

    /**
     * Composes the calendar embed and sends a render request to the display
     * @param refreshCache whether to refresh the upcomingSessions cache
     */
    private async renderCalendarEmbeds(refreshCache: boolean): Promise<void> {
        const [serverId, queueName, state] = [
            this.queueChannel.channelObj.guild.id,
            this.queueChannel.queueName,
            CalendarExtensionState.states.get(this.queueChannel.channelObj.guild.id)
        ];
        if (!state) {
            return;
        }
        if (refreshCache) {
            this.lastUpdatedTimeStamp = new Date();
        }
        this.upcomingSessions = refreshCache
            ? await getUpComingTutoringEvents(serverId, queueName)
            : this.upcomingSessions;
        const upcomingSessionsEmbed = new EmbedBuilder()
            .setTitle(`Upcoming Sessions for ${queueName}`)
            .setDescription(
                composeUpcomingSessionsEmbedBody(
                    this.upcomingSessions,
                    this.queueChannel,
                    this.lastUpdatedTimeStamp
                )
            )
            .setColor(EmbedColor.Blue)
            .setFooter({
                text: 'This embed shows up to 5 most recent sessions and auto refreshes every hour. ',
                iconURL: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/2048px-Google_Calendar_icon_%282020%29.svg.png`
            });
        const refreshButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
                components: [refreshButton]
            },
            this.renderIndex
        );
    }
}

export { CalendarQueueExtension };
