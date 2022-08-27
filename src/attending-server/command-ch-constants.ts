import fs from "fs";

enum CommandAccessLevel {
    ANYONE,
    STAFF,
    ADMIN,
}

const AdminCommands = fs.readFileSync(
    __dirname + "/../../../help-channel-messages/admin-commands.txt",
    { encoding: "utf8" }
);

const HelperCommands = fs.readFileSync(
    __dirname + "/../../../help-channel-messages/helper-commands.txt",
    { encoding: "utf8" }
);

const StudentCommands = fs.readFileSync(
    __dirname + "/../../../help-channel-messages/student-commands.txt",
    { encoding: "utf8" }
);

export const commandChConfigs = {
    admin: {
        channelName: 'admin-commands',
        file: AdminCommands,
        visibility: CommandAccessLevel.ADMIN
    },
    helper: {
        channelName: 'helper-commands',
        file: HelperCommands,
        visibility: CommandAccessLevel.ANYONE
    },
    student: {
        channelName: 'student-commands',
        file: StudentCommands,
        visibility: CommandAccessLevel.ANYONE
    }
};
