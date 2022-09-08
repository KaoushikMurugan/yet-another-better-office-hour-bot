import { CategoryChannel } from "discord.js";
import { AttendingServerV2 } from "../../attending-server/base-attending-server";
import { BaseServerExtension } from "../extension-interface";
import { calendarCommandChConfigs } from "./CalendarCommands";

class CalendarServerExtension extends BaseServerExtension {
    private constructor() {
        super();
    }

    static async load(): Promise<CalendarServerExtension> {
        return new CalendarServerExtension();
    }

    override async onServerInitSuccess(server: Readonly<AttendingServerV2>): Promise<void> {
        const allChannels = await server.guild.channels.fetch();
        const existingHelpCategory = allChannels
            .filter(
                ch =>
                    ch.type === "GUILD_CATEGORY" &&
                    ch.name === "Bot Commands Help"
            )
            .map(ch => ch as CategoryChannel);
        await server.sendCommandHelpMessages(existingHelpCategory, calendarCommandChConfigs, false);
    }
}

export { CalendarServerExtension }