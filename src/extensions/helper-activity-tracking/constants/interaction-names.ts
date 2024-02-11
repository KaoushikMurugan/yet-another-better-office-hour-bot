import type { EnsureCorrectEnum } from '../../../utils/type-aliases.js';

enum ActivityTrackingCommandNames {
    dump_tracking_data = 'dump_tracking_data'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type A = EnsureCorrectEnum<typeof ActivityTrackingCommandNames>;

export { ActivityTrackingCommandNames };
