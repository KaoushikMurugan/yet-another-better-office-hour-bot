import { GoogleSpreadsheet } from "google-spreadsheet";
import { Helper } from "../../models/member-states";
import { BaseServerExtension } from "../extension-interface";
import { ExtensionSetupError } from '../../utils/error-types';
import gcs_creds from "../gcs_service_account_key.json";
import { FgBlue, FgRed, ResetColor } from "../../utils/command-line-colors";
import { attendaceExtensionConfig } from './attendance-config';

class AttendanceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AttendanceError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

class AttendanceExtension extends BaseServerExtension {

    constructor(
        private serverName: string,
        private attendanceDoc: GoogleSpreadsheet
    ) { super(); }

    static async load(serverName: string): Promise<AttendanceExtension> {
        if (attendaceExtensionConfig.YABOB_GOOGLE_SHEET_ID === undefined ||
            gcs_creds === undefined) {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}No Google Sheet ID or Google Cloud credentials found.${ResetColor}\n` +
                ` - Make sure you have the google sheets id in attendance-config.ts ` +
                ` and Google Cloud credentials in gcs_service_account_key.json`
            ));
        }
        const attendanceDoc = new GoogleSpreadsheet(attendaceExtensionConfig.YABOB_GOOGLE_SHEET_ID);
        await attendanceDoc.useServiceAccountAuth(gcs_creds);
        await attendanceDoc.loadInfo().catch(() => {
            return Promise.reject(new ExtensionSetupError(
                `${FgRed}Failed to load google sheet for ${serverName}. ` +
                `Google sheets rejected our connection.${ResetColor}`
            ));
        });
        console.log(
            `[${FgBlue}Attendance Extension${ResetColor}] successfully loaded for '${serverName}'!\n` +
            ` - Using this google sheet: ${attendanceDoc.title}`
        );
        return new AttendanceExtension(serverName, attendanceDoc);
    }

    override async onHelperStopHelping(
        helper: Readonly<Required<Helper>>
    ): Promise<void> {
        await this.updateAttendance(helper)
            .catch(() => Promise.reject(
                new AttendanceError(
                    `Failed to update attendace.\n` +
                    `Don't worry, your time is still being logged, ` +
                    `just not viewable on Google Sheets. ` +
                    `Please contact @Officer to manually update.`
                )
            ));
    }

    private async updateAttendance(
        helper: Readonly<Required<Helper>>
    ): Promise<void> {
        // try to find existing sheet
        // if not created, make a new one
        let sheetForThisServer = this.attendanceDoc.sheetsByTitle[this.serverName];
        if (sheetForThisServer === undefined) {
            sheetForThisServer = await this.attendanceDoc.addSheet({
                title: this.serverName,
                headerValues: [
                    "Username",
                    "Time In",
                    "Time Out",
                    "Helped Students",
                ],
            });
        }

        await sheetForThisServer.addRow({
            "Username": helper.member.user.username,
            "Time In": `${helper.helpStart.toLocaleDateString()} ` +
                `${helper.helpStart.toLocaleTimeString()}`,
            "Time Out": `${helper.helpEnd.toLocaleDateString()} ` +
                `${helper.helpEnd.toLocaleTimeString()}`,
            "Helped Students": JSON.stringify(
                helper.helpedMembers.map(student => new Object({
                    displayName: student.nickname ?? student.displayName,
                    username: student.user.username
                }))),
        });
    }
}

export { AttendanceExtension };