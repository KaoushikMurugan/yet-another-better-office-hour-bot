class CommandParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CommandError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

class ServerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ServerError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

class QueueError extends Error {
    constructor(message: string,
        public queueName: string) {
        super(message);
        this.name = "QueueError";
    }
    briefErrorString(): string {
        return `**${this.name}** at ${this.queueName}: ${this.message}`;
    }
}

type AnyError = CommandParseError | ServerError | QueueError;

export { CommandParseError, ServerError, QueueError, AnyError };