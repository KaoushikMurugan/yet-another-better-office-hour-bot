import { Guild } from 'discord.js';
import { BaseServerExtension } from '../extension-interface.js';
import { FrozenServer } from '../extension-utils.js';
import { CalendarExtensionState } from './calendar-states.js';
import { blue } from '../../utils/command-line-colors.js';

/**
 * Server extension of session calendar
 * - only handles memory clean up, clearing the timer, and creating the state object
 */
class CalendarServerExtension extends BaseServerExtension {
    /**
     * Timer id of the setInterval call in the constructor, cleared on server delete
     */
    private timerId;

    constructor(public readonly guild: Guild) {
        super();
        // sets up the refresh timer
        this.timerId = setInterval(async () => {
            const state = CalendarExtensionState.allStates.get(guild.id);
            if (state) {
                await state.refreshCalendarEvents();
                await state.emitStateChangeEvent();
            }
        }, 15 * 60 * 1000);
    }

    /**
     * Creates the server extension & loads the server level state
     * @param guild
     * @returns the newly created extension
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
     * Populate the upcoming sessions cache on serer create
     * @param server
     */
    override async onServerInitSuccess(server: FrozenServer): Promise<void> {
        const state = CalendarExtensionState.allStates.get(server.guild.id);
        await state?.refreshCalendarEvents();
        await state?.emitStateChangeEvent();
    }

    /**
     * If a server gets deleted, remove it from the calendar server map
     */
    override onServerDelete(server: FrozenServer): Promise<void> {
        // timers must be cleared,
        // otherwise the timer arrow func will still hold the reference to the deleted instance
        clearInterval(this.timerId);
        CalendarExtensionState.allStates.delete(server.guild.id);
        return Promise.resolve();
    }
}

export { CalendarServerExtension };
