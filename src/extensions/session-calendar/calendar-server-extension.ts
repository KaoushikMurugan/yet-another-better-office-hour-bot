import { Guild } from 'discord.js';
import { BaseServerExtension } from '../extension-interface.js';
import { environment } from '../../environment/environment-manager.js';
import { blue, yellow } from '../../utils/command-line-colors.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { ExpectedCalendarErrors } from './calendar-constants/expected-calendar-errors.js';
import { checkCalendarConnection } from './shared-calendar-functions.js';
import { FrozenServer } from '../extension-utils.js';
import { CalendarExtensionState } from './calendar-states.js';

class CalendarServerExtension extends BaseServerExtension {
    constructor(public readonly guild: Guild) {
        super();
    }

    static async load(guild: Guild): Promise<CalendarServerExtension> {
        if (
            environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID.length === 0 ||
            environment.sessionCalendar.YABOB_GOOGLE_API_KEY.length === 0
        ) {
            throw new ExtensionSetupError('Make sure you have Calendar ID and API key');
        }
        const calendarName = await checkCalendarConnection(
            environment.sessionCalendar.YABOB_DEFAULT_CALENDAR_ID
        ).catch(() => {
            throw ExpectedCalendarErrors.badId.defaultId;
        });
        console.log(
            `[${blue('Session Calendar')}] ` +
                `successfully loaded for '${guild.name}'!\n` +
                ` - Using ${yellow(calendarName)} as the default calendar`
        );
        const instance = new CalendarServerExtension(guild);
        await CalendarExtensionState.load(guild, instance);
        return instance;
    }

    /**
     * If a server gets deleted, remove it from the calendar server map
     * @param server
     */
    override onServerDelete(server: FrozenServer): Promise<void> {
        CalendarExtensionState.states.delete(server.guild.id);
        return Promise.resolve();
    }
}

export { CalendarServerExtension };
