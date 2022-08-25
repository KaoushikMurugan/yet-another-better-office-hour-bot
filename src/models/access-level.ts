import { ColorResolvable } from "discord.js";

export enum CommandAccessLevel {
    ANYONE,
    STAFF,
    ADMIN,
}

/**
 * Order the config objects in the order of hight -> low hierearchy
 * If the bot starts with an empty server,
 * there won't be enough indexes to raise the bot's position high enough
*/

export const hierarchyRoleConfigs = [
    {
        name: "Admin",
        color: "DARK_VIVID_PINK" as ColorResolvable,
        hoist: true,
    },
    {
        name: "Student",
        color: "GREEN" as ColorResolvable, // casting is safe here
        hoist: true,
    },
    {
        name: "Staff",
        color: "RED" as ColorResolvable,
        hoist: true,
    },
];