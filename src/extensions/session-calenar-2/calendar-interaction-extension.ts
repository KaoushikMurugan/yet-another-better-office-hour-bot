import { Guild } from 'discord.js';
import {
    BaseInteractionExtension2,
    IInteractionExtension2
} from '../extension-interface.js';
import { calendarCommands } from '../session-calendar/command-handling/command/calendar-slash-commands.js';
import { environment } from '../../environment/environment-manager.js';
import { blue, yellow } from '../../utils/command-line-colors.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import {
    calendarStates,
    CalendarExtensionState
} from '../session-calendar/calendar-states.js';
import {
    calendarAdminHelpMessages,
    calendarHelperHelpMessages,
    calendarStudentHelpMessages
} from '../session-calendar/command-handling/command/CalendarCommands.js';
import { ExpectedCalendarErrors } from '../session-calendar/expected-calendar-errors.js';
import { checkCalendarConnection } from '../session-calendar/shared-calendar-functions.js';
import {
    ButtonHandlerProps,
    CommandHandlerProps,
    ModalSubmitHandlerProps
} from '../../interaction-handling/handler-interface.js';
import { calendarCommandMap } from './interaction-handling/command-handler.js';
import { calendarButtonMap } from './interaction-handling/button-handler.js';
import { calendarModalMap } from './interaction-handling/modal-handler.js';
import { calendarSettingsMainMenuOptions } from '../session-calendar/command-handling/calendar-settings-menus.js';

class SessionCalendarInteractionExtension
    extends BaseInteractionExtension2
    implements IInteractionExtension2
{
    override async loadState(guild: Guild): Promise<void> {
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
        console.log(
            `[${blue('Session Calendar')}] ` +
                `successfully loaded for '${guild.name}'!\n` +
                ` - Using ${yellow(calendarName)} as the default calendar`
        );
    }

    override helpMessages = {
        botAdmin: calendarAdminHelpMessages,
        staff: calendarHelperHelpMessages,
        student: calendarStudentHelpMessages
    };

    override settingsMainMenuOptions = calendarSettingsMainMenuOptions;

    override slashCommandData = calendarCommands;

    override commandMap: CommandHandlerProps = calendarCommandMap;

    override buttonMap: ButtonHandlerProps = calendarButtonMap;

    override modalMap: ModalSubmitHandlerProps = calendarModalMap;
}

export { SessionCalendarInteractionExtension };
