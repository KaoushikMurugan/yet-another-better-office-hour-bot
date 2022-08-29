import { GoogleApis } from "googleapis";
import { BaseQueueExtension } from "./base-interface";


class CalendarExtension extends BaseQueueExtension {

    constructor(
        private googleCalendar: GoogleApis = new GoogleApis()
    ) { super(); }


}


export { CalendarExtension };