// Please see the setup guide on how to find the following credentials.

import { Collection } from "discord.js";
import { CalendarQueueExtension } from "./calendar-queue-extension";
/**
 * This manages the state of the calendar extension
 * Calendar extension only need to worry about calendar switches, 
 * so I didn't set up different event listeners.
 * 
 * If your extension is more sophisticated, you should set up different event listeners.
 * Make sure to use hashmaps. O(n) is very slow for a network heavy application.
 * */

// key is server id, value is 1 calendar extension state
const serverIdStateMap = new Collection<string, CalendarExtensionState>();

interface CalendarExtensionState {
    calendarId: string;
    calendarNameDiscordIdMap: Collection<string, string>;
    listeners: Collection<string, CalendarQueueExtension>;
}

export { CalendarExtensionState, serverIdStateMap };

