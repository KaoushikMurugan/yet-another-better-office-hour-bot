import fs from "fs";
import { CommandAccessLevel } from '../command_handler';


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

export const CommandChConfig = {
    admin: {
        name: 'admin-commands',
        file: AdminCommands,
        visibility: CommandAccessLevel.ADMIN
    },
    helper: {
        name: 'helper-commands',
        file: HelperCommands,
        visibility: CommandAccessLevel.ANYONE
    },
    student: {
        name: 'student-commands',
        file: StudentCommands,
        visibility: CommandAccessLevel.ANYONE
    }
};
