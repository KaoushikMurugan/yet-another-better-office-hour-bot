import {
    GoogleSpreadsheet,
    GoogleSpreadsheetWorksheet,
} from "google-spreadsheet";

export type TutorInfo = {
    tutor_info_doc: GoogleSpreadsheet;
    tutor_info_sheet: GoogleSpreadsheetWorksheet;
    tutor_info_calendar: string;
};
