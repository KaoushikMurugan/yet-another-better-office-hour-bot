// Please see the setup guide on how to find the following credentials.

import { Collection } from "discord.js";
import { CalendarQueueExtension } from "./calendar-queue-extension";

// key is server id, value is 1 calendar extension state
const serverIdStateMap = new Collection<string, CalendarExtensionState>();

interface CalendarExtensionState {
    calendarId: string;
    // save the data from /make_calendar_string
    calendarNameDiscordIdMap: Collection<string, string>;
    // event listeners, their onCalendarStateChange will be called
    listeners: Collection<string, CalendarQueueExtension>;
}

export { CalendarExtensionState, serverIdStateMap };

