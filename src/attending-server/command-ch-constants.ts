/**
 * @packageDocumentation
 * @module AttendingServerV2
 */
import { adminCommandHelpMessages } from '../../help-channel-messages/AdminCommands.js';
import { helperCommandHelpMessages } from '../../help-channel-messages/HelperCommands.js';
import { studentCommandHelpMessages } from '../../help-channel-messages/StudentCommands.js';
import { AccessLevelRole } from '../models/access-level-roles.js';
import { HelpMessage } from '../utils/type-aliases.js';

/**
 * An object that groups the help messages and the visibility together
 * - Used when creating new help channels
 */
export const commandChannelConfigs: {
    /** The name of the created channel  */
    channelName: string;
    /** Help message content */
    helpMessages: HelpMessage[];
    /** which access level role can see this channel */
    visibility: AccessLevelRole[];
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
