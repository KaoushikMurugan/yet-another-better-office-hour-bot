/** @module SessionCalendar */
import { BaseQueueExtension, IQueueExtension } from '../extension-interface.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { EmbedColor } from '../../utils/embed-helper.js';
import { red } from '../../utils/command-line-colors.js';
import { calendarStates } from './calendar-states.js';
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

/**
 * Calendar Extension for individual queues
 * ----
 * - All instances read from the calendar in serverIdStateMap.get(serverId)
 * - Each instance only looks for the class it's responsible for
 */
class CalendarQueueExtension extends BaseQueueExtension implements IQueueExtension {
    private upcomingSessions: UpComingSessionViewModel[] = [];
    private display?: FrozenDisplay;
    private lastUpdatedTimeStamp = new Date();

    private constructor(
        private readonly renderIndex: RenderIndex,
        private readonly queueChannel: QueueChannel
    ) {
        super();
    }

    /**
     * Initializes the calendar extension
     * @param renderIndex the index of the embed message given by the queue
     * @param queueChannel channel object
     */
    static async load(
        renderIndex: RenderIndex,
        queueChannel: QueueChannel
    ): Promise<CalendarQueueExtension> {
        if (!calendarStates.has(queueChannel.channelObj.guild.id)) {
            throw new ExtensionSetupError(
                red('The command level extension is required.')
            );
        }
        const instance = new CalendarQueueExtension(renderIndex, queueChannel);
        calendarStates
            .get(queueChannel.channelObj.guild.id)
            ?.listeners.set(queueChannel.queueName, instance);
        return instance;
    }

    /**
     * Every time queue emits onQueuePeriodicUpdate,
     * fecth new events and update cached viewModel
     */
    override async onQueuePeriodicUpdate(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _queue: FrozenQueue,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _isFirstCall: boolean
    ): Promise<void> {
        await this.renderCalendarEmbeds(true);
    }

    /**
     * Embeds the upcoming hours into the queue channel
     */
    override async onQueueRender(
        _queue: FrozenQueue,
        display: FrozenDisplay
    ): Promise<void> {
        this.display = display;
        await this.renderCalendarEmbeds(false);
    }

    /**
     * Removes `deletedQueue` from the listeners map
     * @param deletedQueue
     */
    override async onQueueDelete(deletedQueue: FrozenQueue): Promise<void> {
        calendarStates
            .get(this.queueChannel.channelObj.guild.id)
            ?.listeners.delete(deletedQueue.queueName);
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
            calendarStates.get(this.queueChannel.channelObj.guild.id)
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
        this.display?.requestNonQueueEmbedRender(
            {
                embeds: [upcomingSessionsEmbed],
                components: [refreshButton]
            },
            this.renderIndex
        );
    }
}

export { CalendarQueueExtension };
