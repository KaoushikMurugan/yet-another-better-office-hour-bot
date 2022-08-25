import {
    GoogleSpreadsheet,
    GoogleSpreadsheetWorksheet,
} from "google-spreadsheet";

export type TutorInfoSheet = {
    tutor_info_doc: GoogleSpreadsheet; // The entire spreadsheet
    tutor_info_sheet: GoogleSpreadsheetWorksheet; // an individual sheet in the document
    tutor_info_calendar: string; // calendar api string??
};
