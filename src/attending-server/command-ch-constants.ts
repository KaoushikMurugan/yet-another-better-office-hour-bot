import { adminCommandsEmbed } from '../../help-channel-messages/AdminCommands';
import { helperCommandsEmbed } from '../../help-channel-messages/HelperCommands';
import { studentCommandsEmbed } from '../../help-channel-messages/StudentCommands';

export const commandChConfigs = [
    {
        channelName: 'admin-commands',
        file: adminCommandsEmbed,
        visibility: ['Bot Admin']
    },
    {
        channelName: 'staff-commands',
        file: helperCommandsEmbed,
        visibility: ['Bot Admin', 'Staff']
    },
    {
        channelName: 'student-commands',
        file: studentCommandsEmbed,
        visibility: ['Bot Admin', 'Staff', 'Student']
    }
];
