import { adminHelpChannelEmbeds } from '../../help-channel-messages/AdminCommands';
import { helperHelpChannelEmbeds } from '../../help-channel-messages/HelperCommands';
import { studentHelpChannelEmbeds } from '../../help-channel-messages/StudentCommands';

export const commandChConfigs = [
    {
        channelName: 'admin-commands',
        file: adminHelpChannelEmbeds,
        visibility: ['Bot Admin']
    },
    {
        channelName: 'staff-commands',
        file: helperHelpChannelEmbeds,
        visibility: ['Bot Admin', 'Staff']
    },
    {
        channelName: 'student-commands',
        file: studentHelpChannelEmbeds,
        visibility: ['Bot Admin', 'Staff', 'Student']
    }
];
