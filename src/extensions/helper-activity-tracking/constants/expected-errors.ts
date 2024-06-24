import { ServerError } from '../../../utils/error-types.js';

const ExpectedActivityTrackingErrors = {
    cannotWriteFile: new ServerError(
        'Cannot write tracking data to a CSV file. Please contact the host of this YABOB instance.',
        'If you invited this YABOB through the link on Github, please open a new issue.'
    )
} as const;

export { ExpectedActivityTrackingErrors };
