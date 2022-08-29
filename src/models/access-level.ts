import { ColorResolvable } from "discord.js";

/**
 * Order the config objects in the order of hight -> low hierearchy if the bot starts with an empty server
 * Otherwise there won't be enough indices to raise the bot's position high enough
*/
export const hierarchyRoleConfigs = [
    {
        name: "Admin",
        color: "LUMINOUS_VIVID_PINK" as ColorResolvable,
        hoist: true,
    },
    {
        name: "Staff",
        color: "RED" as ColorResolvable,
        hoist: true,
    },
    {
        name: "Student",
        color: "GREEN" as ColorResolvable, // casting is safe here
        hoist: true,
    },
    {
        name: "Verified Email",
        color: "YELLOW" as ColorResolvable,
        hoist: true,
    },
];