/**
 * @packageDocumentation
 * @module AttendingServerV2
 */
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands.js';
import { HierarchyRoles } from '../models/hierarchy-roles.js';
import { HelpMessage } from '../utils/type-aliases.js';

/**
 * An object that groups the help messages and the visibility together
 * - Used when creating new help channels
 */
export const commandChannelConfigs: {
    channelName: string;
    helpMessages: HelpMessage[];
    visibility: (keyof HierarchyRoles)[];
}[] = [
    {
        channelName: 'admin-commands',
        helpMessages: adminCommandHelpMessages,
        visibility: ['botAdmin']
    },
    {
        channelName: 'staff-commands',
        helpMessages: helperCommandHelpMessages,
        visibility: ['botAdmin', 'staff']
    },
    {
        channelName: 'student-commands',
        helpMessages: studentCommandHelpMessages,
        visibility: ['botAdmin', 'staff', 'student']
    }
];
