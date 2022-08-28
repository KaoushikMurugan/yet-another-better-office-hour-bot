/**
 * !! Important !!
 * ----
 * All extensions will be called with Promise.all()
 * this means that extensions will be launched in parallel
 * To avoid race conditions, do not let extensions modify shared data values
*/

// Server only extensions
interface IServerExtension {
    onServerInitSuccess: () => Promise<void>;
    onAllQueueInit: () => Promise<void>;
    onQueueDelete: () => Promise<void>;
    onDequeueFirst: () => Promise<void>;
    onHelperStartHelping: () => Promise<void>;
    onHelperStopHelping: () => Promise<void>;
}

// Extensions for individual queues
interface IQueueExtension {
    onQueueCreate: () => Promise<void>;
    onQueueRenderComplete: () => Promise<void>;
    onQueueClose: () => Promise<void>;
    onQueueOpen: () => Promise<void>;
    onEnqueue: () => Promise<void>;
    onDequeue: () => Promise<void>;
    onStudentRemove: () => Promise<void>;
    onRemoveAllStudents: () => Promise<void>;
}


/**
 * Base class of server related extensions. 
 * ----
 * - Any SERVER extension must inherit from here
 * - Override the events that you want to trigger
*/
class DoNothingServerExtension implements IServerExtension {
    onServerInitSuccess(): Promise<void> {
        return Promise.resolve();
    }
    onAllQueueInit(): Promise<void> {
        return Promise.resolve();
    }
    onQueueDelete(): Promise<void> {
        return Promise.resolve();
    }
    onDequeueFirst(): Promise<void> {
        return Promise.resolve();
    }
    onHelperStartHelping(): Promise<void> {
        return Promise.resolve();
    }
    onHelperStopHelping(): Promise<void> {
        return Promise.resolve();
    }
}

/**
 * Base class of individual-queue related extensions. 
 * ----
 * - Any QUEUE extension must inherit from here
 * - Override the events that you want to trigger
*/
class DoNothingQueueExtension implements IQueueExtension {
    onQueueCreate(): Promise<void> {
        return Promise.resolve();
    }
    onQueueRenderComplete(): Promise<void> {
        return Promise.resolve();
    }
    onQueueClose(): Promise<void> {
        return Promise.resolve();
    }
    onQueueOpen(): Promise<void> {
        return Promise.resolve();
    }
    onEnqueue(): Promise<void> {
        return Promise.resolve();
    }
    onDequeue(): Promise<void> {
        return Promise.resolve();
    }
    onStudentRemove(): Promise<void> {
        return Promise.resolve();
    }
    onRemoveAllStudents(): Promise<void> {
        return Promise.resolve();
    }
}

export {
    IServerExtension,
    IQueueExtension,
    DoNothingServerExtension,
    DoNothingQueueExtension
};