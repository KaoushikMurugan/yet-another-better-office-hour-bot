interface IExtensionForYABOB {
    onQueueOpen: () => Promise<void>;
    onQueueClose: () => Promise<void>;
    onQueueRender: () => Promise<void>;
    onStudentJoin: () => Promise<void>;
    onStudentLeave: () => Promise<void>;
}


/**
 * Base class of any YABOB extension. Any extension must inherit from here
 * ----
 * - Override the events that you want to trigger
*/
class DoNothingExtension implements IExtensionForYABOB {
    onQueueOpen(): Promise<void> {
        return Promise.resolve();
    }
    onQueueClose(): Promise<void> {
        return Promise.resolve();
    }
    onQueueRender(): Promise<void> {
        return Promise.resolve();
    }
    onStudentJoin(): Promise<void> {
        return Promise.resolve();
    }
    onStudentLeave(): Promise<void> {
        return Promise.resolve();
    }
}

export { IExtensionForYABOB, DoNothingExtension };