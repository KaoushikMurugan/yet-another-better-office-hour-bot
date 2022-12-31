import { SimpleEmbed } from '../../../utils/embed-helper.js';
import { YabobEmbed } from '../../../utils/type-aliases.js';

const GoogleSheetSuccessMessages = {
    updatedGoogleSheet: (newSheetTitle: string): YabobEmbed =>
        SimpleEmbed(`Successfully changed to this new google sheet: ${newSheetTitle}`)
};

export { GoogleSheetSuccessMessages };
