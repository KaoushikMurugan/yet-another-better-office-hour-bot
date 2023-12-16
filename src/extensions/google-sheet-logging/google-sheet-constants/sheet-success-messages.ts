import { EmbedColor, SimpleEmbed } from '../../../utils/embed-helper.js';
import { YabobEmbed } from '../../../utils/type-aliases.js';

const GoogleSheetSuccessMessages = {
    updatedGoogleSheet: (newSheetTitle: string): YabobEmbed =>
        SimpleEmbed(
            `Successfully changed to this new google sheet: ${newSheetTitle}`,
            EmbedColor.Success
        ),
    updatedSheetTracking: (newTrackingStatus: boolean): YabobEmbed =>
        SimpleEmbed(
            `Successfully ${
                newTrackingStatus ? 'enabled' : 'disabled'
            } google sheet tracking`,
            EmbedColor.Success
        )
} as const;

export { GoogleSheetSuccessMessages };
