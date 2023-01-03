import { Guild } from 'discord.js';
import { BaseServerExtension } from '../extension-interface.js';
import { FrozenServer } from '../extension-utils.js';
import { CalendarExtensionState } from './calendar-states.js';
import { blue } from '../../utils/command-line-colors.js';

/**
 * Server extension of session calendar
 * - only handles memory clean up and creating the state object
 */
class CalendarServerExtension extends BaseServerExtension {
    /**
     * Timer id of the setInterval call in the constructor
     */
    private timerId;

    constructor(public readonly guild: Guild) {
        super();
        // sets up the refresh timer
        this.timerId = setInterval(async () => {
            const state = CalendarExtensionState.states.get(guild.id);
            if (state) {
                await state.refreshCalendarEvents();
                await Promise.all(
                    state.queueExtensions.map(queueExt =>
                        queueExt.onCalendarStateChange()
                    )
                );
            }
        }, 15 * 60 * 1000);
    }

    /**
     * Creates the server extension & loads the server level state
     * @param guild
     * @returns
     */
    static async load(guild: Guild): Promise<CalendarServerExtension> {
        const instance = new CalendarServerExtension(guild);
        await CalendarExtensionState.load(guild, instance);
        console.log(
            `[${blue('Session Calendar')}] successfully loaded for '${guild.name}'!`
        );
        return instance;
    }

    /**
     * If a server gets deleted, remove it from the calendar server map
     */
    override onServerDelete(server: FrozenServer): Promise<void> {
        // timers must be cleared,
        // otherwise the timer arrow func will still hold the reference to the deleted instance
        clearInterval(this.timerId);
        CalendarExtensionState.states.delete(server.guild.id);
        return Promise.resolve();
    }
}

export { CalendarServerExtension };
