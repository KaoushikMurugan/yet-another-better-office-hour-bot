/** @module SessionCalendar */
import { BaseQueueExtension, IQueueExtension } from '../extension-interface.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { HelpQueueV2 } from '../../help-queue/help-queue.js';
import { QueueDisplayV2 } from '../../help-queue/queue-display.js';
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

/**
 * Calendar Extension for individual queues
 * ----
 * - All instances read from the calendar in serverIdStateMap.get(serverId)
 * - Each instance only looks for the class it's responsible for
 */
class CalendarQueueExtension extends BaseQueueExtension implements IQueueExtension {
    private upcomingSessions: UpComingSessionViewModel[] = [];
    private display?: Readonly<QueueDisplayV2>;

    private constructor(
        private readonly renderIndex: number,
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
        renderIndex: number,
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
        _queue: Readonly<HelpQueueV2>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _isFirstCall: boolean
    ): Promise<void> {
        await this.renderCalendarEmbeds(true);
    }

    /**
     * Embeds the upcoming hours into the queue channel
     */
    override async onQueueRender(
        _queue: Readonly<HelpQueueV2>,
        display: Readonly<QueueDisplayV2>
    ): Promise<void> {
        this.display = display;
        await this.renderCalendarEmbeds(false);
    }

    /**
     * Removes `deletedQueue` from the listeners map
     * @param deletedQueue
     */
    override async onQueueDelete(deletedQueue: Readonly<HelpQueueV2>): Promise<void> {
        calendarStates
            .get(this.queueChannel.channelObj.guild.id)
            ?.listeners.delete(deletedQueue.queueName);
        // now garbage collector should clean up this instance
        // when server deletes the queue from queue collection
    }

    /**
     * Event listener/subscriber for changes in calendarExtensionStates
     */
    async onCalendarExtensionStateChange(): Promise<void> {
        await this.renderCalendarEmbeds(true);
    }

    /**
     * Composes the calendar embed and sends a render request to the display
     * @param refreshCache whether to refresh the upcomingSessions cache
     */
    private async renderCalendarEmbeds(refreshCache: boolean): Promise<void> {
        const [serverId, queueName] = [
            this.queueChannel.channelObj.guild.id,
            this.queueChannel.queueName
        ];
        this.upcomingSessions = refreshCache
            ? await getUpComingTutoringEvents(serverId, queueName)
            : this.upcomingSessions;
        const calendarId = calendarStates.get(
            this.queueChannel.channelObj.guild.id
        )?.calendarId;
        const publicEmbedUrl = calendarStates.get(
            this.queueChannel.channelObj.guild.id
        )?.publicCalendarEmbedUrl;
        const upcomingSessionsEmbed = new EmbedBuilder()
            .setTitle(`Upcoming Sessions for ${queueName}`)
            .setURL(
                publicEmbedUrl && publicEmbedUrl?.length > 0
                    ? publicEmbedUrl
                    : restorePublicEmbedURL(calendarId ?? '')
            )
            .setDescription(
                composeUpcomingSessionsEmbedBody(this.upcomingSessions, this.queueChannel)
            )
            .setColor(EmbedColor.Blue)
            .setFooter({
                text:
                    'This embed shows up to 5 most recent sessions and auto refreshes every hour. ' +
                    `Click the title to see the full calendar. Last Updated at ${new Date().toLocaleTimeString(
                        'en-US',
                        {
                            timeZone: 'PST8PDT'
                        }
                    )}`,
                iconURL: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/2048px-Google_Calendar_icon_%282020%29.svg.png`
            });
        const refreshButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('refresh ' + queueName)
                .setEmoji('🔄')
                .setLabel('Refresh Upcoming Sessions')
                .setStyle(ButtonStyle.Primary)
        );
        await this.display?.requestNonQueueEmbedRender(
            {
                embeds: [upcomingSessionsEmbed],
                components: [refreshButton]
            },
            this.renderIndex
        );
    }
}

export { CalendarQueueExtension };
