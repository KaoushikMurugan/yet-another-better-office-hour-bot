/**
 * @packageDocumentation
 * @module AttendingServerV2
 */
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands.js';

export const commandChConfigs = [
    {
        channelName: 'admin-commands',
        file: adminCommandHelpMessages,
        visibility: ['Bot Admin']
    },
    {
        channelName: 'staff-commands',
        file: helperCommandHelpMessages,
        visibility: ['Bot Admin', 'Staff']
    },
    {
        channelName: 'student-commands',
        file: studentCommandHelpMessages,
        visibility: ['Bot Admin', 'Staff', 'Student']
    }
];
