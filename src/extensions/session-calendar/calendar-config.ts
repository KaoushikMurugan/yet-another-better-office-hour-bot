// Please see the setup guide on how to find the following credentials.

import { CalendarQueueExtension } from "./calendar-queue-extension";

const calendarExtensionConfig = {
    // Put your calendar ID here.
    // It should end in calendar.google.com
    YABOB_GOOGLE_CALENDAR_ID: "",
    // Put your API Key here.
    YABOB_GOOGLE_API_KEY: ""
};

const calendarExtensionStates = {
    listeners: new Array<CalendarQueueExtension>()
};

export { calendarExtensionConfig, calendarExtensionStates};

