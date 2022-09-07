import { BaseQueueExtension } from "../extension-interface";
import { ExtensionSetupError } from '../../utils/error-types';
import { HelpQueueV2 } from '../../help-queue/help-queue';
import { QueueDisplayV2 } from '../../help-queue/queue-display';
import { EmbedColor } from '../../utils/embed-helper';
import { FgRed, ResetColor } from '../../utils/command-line-colors';
import { serverIdStateMap } from './calendar-states';
import { MessageEmbed, MessageActionRow, MessageButton } from 'discord.js';
import { QueueChannel } from '../../attending-server/base-attending-server';
import calendarConfig from '../extension-credentials/calendar-config.json';
import {
    getUpComingTutoringEvents,
    UpComingSessionViewModel
} from './shared-calendar-functions';

/**
 * Calendar Extension for individual queues
 * ----
 * - All instances read from the calendar in serverIdStateMap.get(serverId)
 * - Each instance only looks for the class it's responsible for
*/
class CalendarQueueExtension extends BaseQueueExtension {

    private upcomingHours: UpComingSessionViewModel[] = [];
    private display!: Readonly<QueueDisplayV2>; // late init in onQueueCreate

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
        if (!serverIdStateMap.has(queueChannel.channelObj.guild.id)) {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}The command level extension is required.${ResetColor}`
            ));
        }

        const instance = new CalendarQueueExtension(renderIndex, queueChannel);
        await getUpComingTutoringEvents(
            queueChannel.channelObj.guild.id,
            queueChannel.queueName
        ).catch(() => Promise.reject((`Failed to load calendar extension.`)));

        serverIdStateMap
            .get(queueChannel.channelObj.guild.id)
            ?.listeners
            .set(queueChannel.queueName, instance);
        return instance;
    }

    /**
     * Grabs the display instance
     * ----
     * @param display the instance
    */
    override async onQueueCreate(
        _queue: Readonly<HelpQueueV2>,
        display: Readonly<QueueDisplayV2>
    ): Promise<void> {
        this.display = display;
    }

    /**
     * Every time queue emits onQueuePeriodicUpdate,
     * fecth new events and update cached viewModel
     * ----
    */
    override async onQueuePeriodicUpdate(
        _queue: Readonly<HelpQueueV2>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _isFirstCall = false
    ): Promise<void> {
        const [serverId, queueName] = [
            this.queueChannel.channelObj.guild.id,
            this.queueChannel.queueName
        ];
        this.upcomingHours = await getUpComingTutoringEvents(
            serverId,
            queueName
        );
    }

    /**
     * Embeds the upcoming hours into the queue channel
     * ----
     * @param isClenupRender if the queue requested a cleanup
    */
    override async onQueueRenderComplete(
        _queue: Readonly<HelpQueueV2>,
        isClenupRender = false
    ): Promise<void> {
        await this.renderCalendarEmbeds(false, isClenupRender);
    }

    /**
     * Event listener/subscriber for changes in calendarExtensionStates
     * ----
    */
    async onCalendarExtensionStateChange(): Promise<void> {
        // true for refresh b/c the refresh button was used.
        // false for isCleanup b/c we are just editing the embed
        await this.renderCalendarEmbeds(true, false);
    }

    private async renderCalendarEmbeds(
        refresh = false,
        isCleanupRender = false
    ): Promise<void> {
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

        await this.display.renderNonQueueEmbeds(
            {
                embeds: [upcomingHoursEmbed],
                components: [refreshButton]
            },
            this.renderIndex,
            isCleanupRender
        ).catch(async () =>
            this.display.renderNonQueueEmbeds(
                {
                    embeds: [upcomingHoursEmbed],
                    components: [refreshButton]
                },
                this.renderIndex,
                true
            )
        );
    }
}

export { CalendarQueueExtension };