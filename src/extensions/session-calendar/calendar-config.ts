// Please see the setup guide on how to find the following credentials.

import { Collection } from "discord.js";
import { CalendarQueueExtension } from "./calendar-queue-extension";

const calendarExtensionConfig = {
    // Put your calendar ID here.
    // It should end in calendar.google.com
    YABOB_GOOGLE_CALENDAR_ID: "",
    // Put your API Key here.
    YABOB_GOOGLE_API_KEY: ""
};

/**
 * This manages the state of the calendar extension
 * Calendar extension only need to worry about calendar switches, 
 * so I didn't set up different event listeners.
 * 
 * If your extension is more sophisticated, you should set up different event listeners.
 * Make sure to use hashmaps. O(n) is very slow for a network heavy application.
 * */
const calendarExtensionStates = {
    listeners: new Collection<string, CalendarQueueExtension>()
};

export { calendarExtensionConfig, calendarExtensionStates };

