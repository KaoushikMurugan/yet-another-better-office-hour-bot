import { BaseQueueExtension } from '../extension-interface';
import { ExtensionSetupError } from '../../utils/error-types';
import { HelpQueueV2 } from '../../help-queue/help-queue';
import { QueueDisplayV2 } from '../../help-queue/queue-display';
import { EmbedColor } from '../../utils/embed-helper';
import { FgRed, ResetColor } from '../../utils/command-line-colors';
import { serverIdCalendarStateMap } from './calendar-states';
import { MessageEmbed, MessageActionRow, MessageButton } from 'discord.js';
import { QueueChannel } from '../../attending-server/base-attending-server';
import {
    getUpComingTutoringEvents,
    UpComingSessionViewModel,
    restorePublicEmbedURL
} from './shared-calendar-functions';

/**
 * Calendar Extension for individual queues
 * ----
 * - All instances read from the calendar in serverIdStateMap.get(serverId)
 * - Each instance only looks for the class it's responsible for
*/
class CalendarQueueExtension extends BaseQueueExtension {

    private upcomingSessions: UpComingSessionViewModel[] = [];
    private display?: Readonly<QueueDisplayV2>;

    private constructor(
        private readonly renderIndex: number,
        private readonly queueChannel: QueueChannel
    ) { super(); }

    /**
     * Initializes the calendar extension
     * ----
     * @param renderIndex the index of the embed message given by the queue
     * @param queueChannel channel object
    */
    static async load(
        renderIndex: number,
        queueChannel: QueueChannel
    ): Promise<CalendarQueueExtension> {
        if (!serverIdCalendarStateMap.has(queueChannel.channelObj.guild.id)) {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}The command level extension is required.${ResetColor}`
            ));
        }
        const instance = new CalendarQueueExtension(renderIndex, queueChannel);
        serverIdCalendarStateMap
            .get(queueChannel.channelObj.guild.id)
            ?.listeners
            .set(queueChannel.queueName, instance);
        return instance;
    }

    /**
     * Every time queue emits onQueuePeriodicUpdate,
     * fecth new events and update cached viewModel
     * ----
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
     * ----
    */
    override async onQueueRender(
        _queue: Readonly<HelpQueueV2>,
        display: Readonly<QueueDisplayV2>
    ): Promise<void> {
        this.display = display;
        await this.renderCalendarEmbeds(false);
    }

    override async onQueueDelete(deletedQueue: Readonly<HelpQueueV2>): Promise<void> {
        serverIdCalendarStateMap
            .get(this.queueChannel.channelObj.guild.id)
            ?.listeners.delete(deletedQueue.name);
        // now garbage collector should clean up this instance
        // when server deletes the queue from queue collection
    }

    /**
     * Event listener/subscriber for changes in calendarExtensionStates
     * ----
    */
    async onCalendarExtensionStateChange(): Promise<void> {

        // true for refresh b/c the refresh button was used.
        const timoutId: NodeJS.Timeout = setTimeout(() => clearTimeout(timoutId), Math.random() * 3000);
        await this.renderCalendarEmbeds(true);
    }

    /**
     * Composes the calendar embed and sends a render request to the display
     * ----
     * @param refresh whether to refresh the upcomingSessions cache
    */
    private async renderCalendarEmbeds(refresh: boolean): Promise<void> {
        const [serverId, queueName] = [
            this.queueChannel.channelObj.guild.id,
            this.queueChannel.queueName
        ];
        this.upcomingSessions = refresh
            ? await getUpComingTutoringEvents(serverId, queueName)
            : this.upcomingSessions;
        const calendarId = serverIdCalendarStateMap.get(this.queueChannel.channelObj.guild.id)?.calendarId;
        const upcomingSessionsEmbed = new MessageEmbed()
            .setTitle(`Upcoming Sessions for ${queueName}`)
            .setURL(restorePublicEmbedURL(calendarId ?? ''))
            .setDescription(
                this.upcomingSessions.length > 0
                    ? this.upcomingSessions
                        .map(viewModel =>
                            `**${viewModel.discordId !== undefined
                                ? `<@${viewModel.discordId}>`
                                : viewModel.displayName
                            }**\t|\t` +
                            `**${viewModel.eventSummary}**\n` +
                            `Start: <t:${viewModel.start.getTime().toString().slice(0, -3)}:R>\t|\t` +
                            `End: <t:${viewModel.end.getTime().toString().slice(0, -3)}:R>` +
                            `${viewModel.location ? `\t|\tLocation: ${viewModel.location}` : ``}`)
                        .join(`\n${'-'.repeat(20)}\n`)
                    : `There are no upcoming sessions for ${queueName} in the next 7 days.`
            )
            .setColor(EmbedColor.NoColor)
            .setFooter({
                text: `This embed shows up to 10 most recent upcoming sessions. Click the title to see the full calendar.`,
                iconURL: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/2048px-Google_Calendar_icon_%282020%29.svg.png`
            });
        const refreshButton = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('refresh ' + queueName)
                    .setEmoji('🔄')
                    .setLabel('Refresh Upcoming Sessions')
                    .setStyle('PRIMARY')
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