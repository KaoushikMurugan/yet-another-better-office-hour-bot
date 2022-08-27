class CommandError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CommandError";
    }
}

class ServerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ServerError";
    }
}

class QueueError extends Error {
    constructor(message: string,
        public queueName: string) {
        super(message);
        this.name = "QueueError";
    }
}

export { CommandError, ServerError, QueueError };