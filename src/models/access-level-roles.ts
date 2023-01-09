import { ColorResolvable, Colors } from 'discord.js';
import { OptionalRoleId } from '../utils/type-aliases.js';

type AccessLevelRole = 'botAdmin' | 'staff' | 'student';

/**
 * The role ids of each access level role
 */
// This syntax is called mapped types
// https://www.typescriptlang.org/docs/handbook/2/mapped-types.html
type AccessLevelRoleIds = { [K in AccessLevelRole]: OptionalRoleId };

/**
 * The default access level role configurations
 * - Used when [Create New Roles] is pressed
 */
const accessLevelRoleConfigs: {
    [K in AccessLevelRole]: {
        /** Backref to the object key */
        key: K;
        /** What's actually displayed on discord */
        displayName: string;
        /** Color, hex value or one of the Colors enum */
        color: ColorResolvable;
        /** Whether to push the higher access level roles to the front */
        hoist: boolean;
    };
} = {
    botAdmin: {
        key: 'botAdmin',
        displayName: 'Bot Admin',
        color: Colors.LuminousVividPink,
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
};

export { accessLevelRoleConfigs, AccessLevelRoleIds, AccessLevelRole };
