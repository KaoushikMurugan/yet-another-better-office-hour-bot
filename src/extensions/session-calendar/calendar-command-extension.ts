/** @module SessionCalendar */
import { Guild } from 'discord.js';
import {
    BaseInteractionExtension,
    IInteractionExtension
} from '../extension-interface.js';
import { CalendarExtensionState, calendarStates } from './calendar-states.js';
import { CommandData } from '../../command-handling/command/slash-commands.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { blue, yellow } from '../../utils/command-line-colors.js';
import { calendarCommands } from './command-handling/command/calendar-slash-commands.js';
import { checkCalendarConnection } from './shared-calendar-functions.js';
import { appendCalendarHelpMessages } from './command-handling/command/CalendarCommands.js';
import { environment } from '../../environment/environment-manager.js';
import { ExpectedCalendarErrors } from './expected-calendar-errors.js';
import { appendSettingsMainMenuOptions } from './command-handling/calendar-settings-menus.js';
import {
    canHandleCalendarButton,
    processCalendarButton
} from './command-handling/button/button-handler.js';
import {
    canHandleCalendarCommand,
    processCalendarCommand
} from './command-handling/command/command-handler.js';
import {
    canHandleCalendarModalSubmit,
    processCalendarModalSubmit
} from './command-handling/modal/modal-handler.js';

class CalendarInteractionExtension
    extends BaseInteractionExtension
    implements IInteractionExtension
{
    protected constructor() {
        super();
    }

    private static helpEmbedsSent = false;

    private static settingsMainMenuOptionSent = false;

    /**
     * - Initializes the calendar extension using firebase backup if available
     * - Adds calendar extension slash commands to the server
     * - Adds calendar extension help messages to respective lists
     * @param guild
     * @returns CalendarInteractionExtension
     */
    static async load(guild: Guild): Promise<CalendarInteractionExtension> {
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
        calendarStates.set(guild.id, await CalendarExtensionState.load(guild));
        const instance = new CalendarInteractionExtension();
        appendCalendarHelpMessages(CalendarInteractionExtension.helpEmbedsSent);
        appendSettingsMainMenuOptions(
            CalendarInteractionExtension.settingsMainMenuOptionSent
        );
        CalendarInteractionExtension.helpEmbedsSent = true;
        CalendarInteractionExtension.settingsMainMenuOptionSent = true;
        console.log(
            `[${blue('Session Calendar')}] ` +
                `successfully loaded for '${guild.name}'!\n` +
                ` - Using ${yellow(calendarName)} as the default calendar`
        );
        return instance;
    }

    override get slashCommandData(): CommandData {
        return calendarCommands;
    }

    override canHandleButton = canHandleCalendarButton;

    override canHandleCommand = canHandleCalendarCommand;

    override canHandleModalSubmit = canHandleCalendarModalSubmit;

    override processCommand = processCalendarCommand;

    override processButton = processCalendarButton;

    override processModalSubmit = processCalendarModalSubmit;
}

export { CalendarInteractionExtension };
