/**
 * !! @see interaction-names.ts for naming convention
 * - Names and values need to be exactly the same
 * because we use the 'in' operator to check if an interaction name is supported
 */

enum CalendarCommandNames {
    set_calendar = 'set_calendar',
    unset_calendar = 'unset_calendar',
    when_next = 'when_next',
    make_calendar_string = 'make_calendar_string',
    make_calendar_string_all = 'make_calendar_string_all',
    set_public_embed_url = 'set_public_embed_url'
}

enum CalendarButtonNames {
    Refresh = 'Refresh',
    ResetCalendarSettings = 'ResetCalendarSettings',
    ShowCalendarSettingsModal = 'ShowCalendarSettingsModal'
}

enum CalendarModalNames {
    // this returns a success message
    CalendarSettingsModal = 'CalendarSettingsModal',
    // this shows a menu
    CalendarSettingsModalMenuVersion = 'CalendarSettingsModalMenuVersion'
}

export { CalendarButtonNames, CalendarCommandNames, CalendarModalNames };
