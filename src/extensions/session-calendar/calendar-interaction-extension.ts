import { BaseInteractionExtension } from '../extension-interface.js';
import { calendarCommands } from './calendar-constants/calendar-slash-commands.js';
import { calendarButtonMap } from './interaction-handling/button-handler.js';
import { calendarCommandMap } from './interaction-handling/command-handler.js';
import { calendarModalMap } from './interaction-handling/modal-handler.js';
import {
    calendarAdminHelpMessages,
    calendarHelperHelpMessages,
    calendarStudentHelpMessages
} from './calendar-constants/CalendarCommands.js';
import { calendarSettingsMainMenuOptions } from './calendar-constants/calendar-settings-menu.js';
import { environment } from '../../environment/environment-manager.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { ExpectedCalendarErrors } from './calendar-constants/expected-calendar-errors.js';
import { checkCalendarConnection } from './shared-calendar-functions.js';
import { blue, yellow } from '../../utils/command-line-colors.js';

class SessionCalendarInteractionExtension extends BaseInteractionExtension {
    override buttonMap = calendarButtonMap;

    override commandMap = calendarCommandMap;

    override helpMessages = {
        botAdmin: calendarAdminHelpMessages,
        staff: calendarHelperHelpMessages,
        student: calendarStudentHelpMessages
    };

    override modalMap = calendarModalMap;

    override settingsMainMenuOptions = calendarSettingsMainMenuOptions;

    override slashCommandData = calendarCommands;

    /**
     * performs initialization checks for the calendar extension
     * - checks if the default calendar id exists and accessible
     * - checks if the API key is valid
     * @throws ExtensionSetupError if calendar id or api key is missing
     * @throws CalendarConnectionError if the connection fails
     */
    override async initializationCheck(): Promise<void> {
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
            `[${blue('Session Calendar')}] Using ${yellow(
                calendarName
            )} as the default calendar`
        );
    }
}

export { SessionCalendarInteractionExtension };
