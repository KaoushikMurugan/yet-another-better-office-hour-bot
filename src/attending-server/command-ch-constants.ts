/**
 * @packageDocumentation
 * @module AttendingServerV2
 */
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands.js';
import { HierarchyRoles } from '../models/hierarchy-roles.js';
import { HelpMessage } from '../utils/type-aliases.js';

export const commandChConfigs: {
    channelName: string;
    file: HelpMessage[];
    visibility: (keyof HierarchyRoles)[];
}[] = [
    {
        channelName: 'admin-commands',
        file: adminCommandHelpMessages,
        visibility: ['botAdmin']
    },
    {
        channelName: 'staff-commands',
        file: helperCommandHelpMessages,
        visibility: ['botAdmin', 'staff']
    },
    {
        channelName: 'student-commands',
        file: studentCommandHelpMessages,
        visibility: ['botAdmin', 'staff', 'student']
    }
];
