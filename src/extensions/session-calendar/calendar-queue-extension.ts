import { BaseQueueExtension } from "../extension-interface";
import { ExtensionSetupError } from '../../utils/error-types';
import { HelpQueueV2 } from '../../help-queue/help-queue';
import { QueueDisplayV2 } from '../../help-queue/queue-display';
import { EmbedColor } from '../../utils/embed-helper';
import { FgRed, ResetColor } from '../../utils/command-line-colors';
import { serverIdCalendarStateMap } from './calendar-states';
import { MessageEmbed, MessageActionRow, MessageButton } from 'discord.js';
import { QueueChannel } from '../../attending-server/base-attending-server';
import calendarConfig from '../extension-credentials/calendar-config.json';
import {
    getUpComingTutoringEvents,
    checkCalendarConnection,
    UpComingSessionViewModel,
    CalendarConnectionError
} from './shared-calendar-functions';

/**
 * Calendar Extension for individual queues
 * ----
 * - All instances read from the calendar in serverIdStateMap.get(serverId)
 * - Each instance only looks for the class it's responsible for
*/
class CalendarQueueExtension extends BaseQueueExtension {

    private upcomingHours: UpComingSessionViewModel[] = [];
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
        if (calendarConfig.YABOB_DEFAULT_CALENDAR_ID.length === 0) {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}Make sure you have Calendar ID ` +
                `& API key in calendar-config.ts.${ResetColor}`
            ));
        }
        if (!serverIdCalendarStateMap.has(queueChannel.channelObj.guild.id)) {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}The command level extension is required.${ResetColor}`
            ));
        }
        const instance = new CalendarQueueExtension(renderIndex, queueChannel);
        await checkCalendarConnection(calendarConfig.YABOB_DEFAULT_CALENDAR_ID)
            .catch(() => Promise.reject(new CalendarConnectionError(
                `The default calendar id is not valid.`
            )));
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
     * @param isFirstCall, don't render on initial call, wait for onQueueRender
    */
    override async onQueuePeriodicUpdate(
        _queue: Readonly<HelpQueueV2>,
        isFirstCall: boolean
    ): Promise<void> {
        const [serverId, queueName] = [
            this.queueChannel.channelObj.guild.id,
            this.queueChannel.queueName
        ];
        this.upcomingHours = await getUpComingTutoringEvents(
            serverId,
            queueName
        );
        // avoid unnecessary render
        if (!isFirstCall) {
            await this.renderCalendarEmbeds(false);
        }
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
        await this.renderCalendarEmbeds(true);
    }

    private async renderCalendarEmbeds(refresh: boolean): Promise<void> {
        const [serverId, queueName] = [
            this.queueChannel.channelObj.guild.id,
            this.queueChannel.queueName
        ];
        this.upcomingHours = refresh
            ? await getUpComingTutoringEvents(serverId, queueName)
            : this.upcomingHours;
        const upcomingHoursEmbed = new MessageEmbed()
            .setTitle(`Upcoming Hours for ${queueName}`)
            .setDescription(
                this.upcomingHours.length > 0
                    ? this.upcomingHours
                        .map(viewModel =>
                            `**${viewModel.discordId !== undefined
                                ? `<@${viewModel.discordId}>`
                                : viewModel.displayName
                            }**\t|\t` +
                            `**${viewModel.eventSummary}**\n` +
                            `Start: <t:${viewModel.start.getTime().toString().slice(0, -3)}:R>\t|\t` +
                            `End: <t:${viewModel.end.getTime().toString().slice(0, -3)}:R>`)
                        .join('\n')
                    : `There are no upcoming sessions for ${queueName} in the next 7 days.`
            )
            .setColor(EmbedColor.NoColor);

        const refreshButton = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("refresh " + queueName)
                    .setEmoji("🔄")
                    .setLabel("Refresh Upcoming Hours")
                    .setStyle("PRIMARY")
            );

        await this.display?.requestNonQueueEmbedRender(
            {
                embeds: [upcomingHoursEmbed],
                components: [refreshButton]
            },
            this.renderIndex
        );
    }
}

export { CalendarQueueExtension };