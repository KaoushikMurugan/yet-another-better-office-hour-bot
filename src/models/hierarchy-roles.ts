import { ColorResolvable } from 'discord.js';

export const hierarchyRoleConfigs = [
    {
        name: 'Bot Admin',
        color: 'LUMINOUS_VIVID_PINK' as ColorResolvable,
        hoist: true,
    },
    {
        name: 'Staff',
        color: 'RED' as ColorResolvable,
        hoist: true,
    },
    {
        name: 'Student',
        color: 'GREEN' as ColorResolvable, // casting is safe here
        hoist: true,
    },
];