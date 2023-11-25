/**
 * !! @see interaction-names.ts for naming convention
 * - Names and values need to be exactly the same
 * because we use the 'in' operator to check if an interaction name is supported
 */

import { EnsureCorrectEnum } from '../../../utils/type-aliases.js';

enum CalendarCommandNames {
    when_next = 'when_next',
    make_calendar_string = 'make_calendar_string',
    make_calendar_string_all = 'make_calendar_string_all'
}

enum CalendarButtonNames {
    Refresh = 'Refresh',
    ResetCalendarSettings = 'ResetCalendarSettings',
    ShowCalendarModalFromSettings = 'ShowCalendarModalFromSettings',
    ShowCalendarModalFromQuickStart = 'ShowCalendarModalFromQuickStart'
}

enum CalendarModalNames {
    // this returns a success message
    CalendarIdModal = 'CalendarIdModal',
    // this shows a menu
    CalendarIdModalSettingsVersion = 'CalendarIdModalSettingsVersion',
    // this shows the quick start menu
    CalendarIdModalQuickStartVersion = 'CalendarIdModalQuickStartVersion'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AllEnumsCorrect = EnsureCorrectEnum<typeof CalendarCommandNames> &
    EnsureCorrectEnum<typeof CalendarButtonNames> &
    EnsureCorrectEnum<typeof CalendarModalNames>;

export { CalendarButtonNames, CalendarCommandNames, CalendarModalNames };
