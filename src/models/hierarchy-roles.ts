import { Colors } from 'discord.js';
import { OptionalRoleId } from '../utils/type-aliases.js';

type HierarchyRoles = {
    botAdmin: OptionalRoleId;
    staff: OptionalRoleId;
    student: OptionalRoleId;
};
/**
 * Used to store the hierarchy role configurations
 */
const hierarchyRoleConfigs = {
    botAdmin: {
        key: 'botAdmin',
        name: 'Bot Admin',
        color: Colors.LuminousVividPink,
        hoist: true
    },
    staff: {
        key: 'staff',
        name: 'Staff',
        color: Colors.Red,
        hoist: true
    },
    student: {
        key: 'student',
        name: 'Student',
        color: Colors.Green,
        hoist: true
    }
} as const;

export { hierarchyRoleConfigs, HierarchyRoles };
