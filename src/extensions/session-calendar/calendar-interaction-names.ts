enum CalendarCommandNames {
    set_calendar = 'set_calendar',
    unset_calendar = 'unset_calendar',
    when_next = 'when_next',
    make_calendar_string = 'make_calendar_string',
    make_calendar_string_all = 'make_calendar_string_all',
    set_public_embd_url = 'set_public_embd_url'
}

enum CalendarButtonNames {
    Refresh = 'Refresh',
    ResetCalendarSettings = 'ResetCalendarSettings',
    ShowCalendarSettingsModal = 'ShowCalendarSettingsModal'
}

enum CalendarSelectMenuNames /** nothing yet */ {}

enum CalendarModalNames {
    // this returns a success message
    CalendarSettingsModal = 'CalendarSettingsModal',
    // this shows a menu
    CalendarSettingsModalMenuVersion = 'CalendarSettingsModalMenuVersion'
}

export {
    CalendarButtonNames,
    CalendarCommandNames,
    CalendarSelectMenuNames,
    CalendarModalNames
};
