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
    constructor(public readonly guild: Guild) {
        super();
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
        CalendarExtensionState.states.delete(server.guild.id);
        return Promise.resolve();
    }
}

export { CalendarServerExtension };
