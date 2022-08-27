/**
 * Describes errors that happen during the parsing stage
 * ----
 * This error should be triggered before any server related methods are called
*/
class CommandParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CommandError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

/**
 * Describes behavioral errors in the server
 * ----
 * This error should be triggered before any queue related methods are called
*/
class ServerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ServerError";
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

/**
 * Describes behavioral errors in a HelpQueue
 * ----
*/
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

// All 3 errors will be presented to the user
type UserViewableError = CommandParseError | ServerError | QueueError;

export { CommandParseError, ServerError, QueueError, UserViewableError };