import { EnsureCorrectEnum } from '../../../utils/type-aliases.js';

enum GoogleSheetCommandNames {
    stats = 'stats',
    weekly_report = 'weekly_report'
}

enum GoogleSheetButtonNames {
    UpdateSheetTrackingStatus = 'UpdateSheetTrackingStatus',
    ResetGoogleSheetSettings = 'ResetGoogleSheetSettings',
    ShowGoogleSheetSettingsModal = 'ShowGoogleSheetSettingsModal'
}

enum GoogleSheetModalNames {
    GoogleSheetSettingsModal = 'GoogleSheetSettingsModal',
    GoogleSheetSettingsModalMenuVersion = 'GoogleSheetSettingsModalMenuVersion'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AllEnumsCorrect = EnsureCorrectEnum<typeof GoogleSheetCommandNames> &
    EnsureCorrectEnum<typeof GoogleSheetButtonNames> &
    EnsureCorrectEnum<typeof GoogleSheetModalNames>; // checks if all names and values are the same

export { GoogleSheetButtonNames, GoogleSheetCommandNames, GoogleSheetModalNames };
