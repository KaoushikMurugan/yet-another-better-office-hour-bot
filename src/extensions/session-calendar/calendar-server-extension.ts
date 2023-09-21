import { Guild } from 'discord.js';
import { BaseServerExtension } from '../extension-interface.js';
import { FrozenServer } from '../extension-utils.js';
import { CalendarExtensionState } from './calendar-states.js';
import { calendarLogger } from './shared-calendar-functions.js';

/**
 * Server extension of session calendar
 * - only handles memory clean up, clearing the timer, and creating the state object
 */
class CalendarServerExtension extends BaseServerExtension {
    /**
     * Timer id of the setInterval call in the constructor, cleared on server delete
     */
    private readonly timerId: NodeJS.Timer;

    constructor(public readonly guild: Guild) {
        super();
        // sets up the refresh timer
        this.timerId = setInterval(async () => {
            const state = CalendarExtensionState.allStates.get(guild.id);
            if (state) {
                await state.refreshCalendarEvents();
                await state.emitStateChangeEvent();
            }
        }, 60 * 60 * 1000);
    }

    /**
     * Creates the server extension & loads the server level state
     * @returns the newly created extension
     */
    static async load(guild: Guild): Promise<CalendarServerExtension> {
        const instance = new CalendarServerExtension(guild);
        await CalendarExtensionState.load(guild, instance);
        calendarLogger.info(`Successfully loaded for '${guild.name}'!`);
        return instance;
    }

    /**
     * If a server gets deleted, remove it from the calendar server map
     * @param server the deleted server
     */
    override async onServerDelete(server: FrozenServer): Promise<void> {
        // typically interval timers that reference member methods must be cleared,
        // otherwise the timer arrow func will still hold the reference to the deleted instance
        clearInterval(this.timerId);
        CalendarExtensionState.allStates.delete(server.guild.id);
    }
}

export { CalendarServerExtension };
