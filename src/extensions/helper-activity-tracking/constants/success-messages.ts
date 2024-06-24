import { EmbedColor, SimpleEmbed } from '../../../utils/embed-helper.js';
import { YabobEmbed } from '../../../utils/type-aliases.js';

const ActivityTrackingSuccessMessages = {
    updatedSheetTracking: (newTrackingStatus: boolean): YabobEmbed =>
        SimpleEmbed(
            `Successfully ${
                newTrackingStatus ? 'enabled' : 'disabled'
            } activity tracking`,
            EmbedColor.Success
        )
} as const;

export { ActivityTrackingSuccessMessages };