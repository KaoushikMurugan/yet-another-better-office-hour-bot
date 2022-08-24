import fs from "fs";

export const AdminCommands = fs.readFileSync(
    __dirname + "/../../help-channel-messages/admin-commands.txt",
    { encoding: "utf8" }
);

export const HelperCommands = fs.readFileSync(
    __dirname + "/../../help-channel-messages/helper-commands.txt",
    { encoding: "utf8" }
);

export const StudentCommands = fs.readFileSync(
    __dirname + "/../../help-channel-messages/student-commands.txt",
    { encoding: "utf8" }
);
