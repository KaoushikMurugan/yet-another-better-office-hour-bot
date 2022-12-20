import { Colors } from 'discord.js';
import { OptionalRoleId } from '../utils/type-aliases.js';

/**
 * The role ids of each hierarchy role
 */
type HierarchyRoles = {
    botAdmin: OptionalRoleId;
    staff: OptionalRoleId;
    student: OptionalRoleId;
};

/**
 * The default hierarchy role configurations
 */
const hierarchyRoleConfigs = {
    botAdmin: {
        /** Backref to the object key */
        key: 'botAdmin',
        /** What's actually displayed on discord */
        displayName: 'Bot Admin',
        /** Color with type `ColorResolvable` */
        color: Colors.LuminousVividPink,
        /** Whether to push the higher hierarchy roles to the front */
        hoist: true
    },
    staff: {
        key: 'staff',
        displayName: 'Staff',
        color: Colors.Red,
        hoist: true
    },
    student: {
        key: 'student',
        displayName: 'Student',
        color: Colors.Green,
        hoist: true
    }
} as const;

export { hierarchyRoleConfigs, HierarchyRoles };
