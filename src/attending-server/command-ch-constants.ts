import { adminCommandsEmbed } from '../../help-channel-messages/AdminCommands';
import { studentCommandsEmbed } from '../../help-channel-messages/StudentCommands';

enum CommandAccessLevel {
    ANYONE,
    STAFF,
    ADMIN,
}

export const commandChConfigs = {
    staff: {
        channelName: 'staff-commands',
        file: adminCommandsEmbed,
        visibility: CommandAccessLevel.ADMIN
    },
    student: {
        channelName: 'student-commands',
        file: studentCommandsEmbed,
        visibility: CommandAccessLevel.ANYONE
    }
};
