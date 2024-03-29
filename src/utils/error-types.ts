/** @module Utilities */

/**
 * Describes errors that happen during the parsing stage
 * - This error should be triggered before any server related methods are called
 */
class CommandParseError extends Error {
    readonly type = 'CommandParseError' as const;
    constructor(
        message: string,
        public description?: string
    ) {
        super(message);
        this.name = 'CommandParseError';
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

/**
 * Describes behavioral errors in the server
 * - This error should be triggered before any queue related methods are called
 */
class ServerError extends Error {
    readonly type = 'ServerError' as const;
    constructor(
        message: string,
        public description?: string
    ) {
        super(message);
        this.name = 'ServerError';
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

/**
 * Describes behavioral errors in a HelpQueue
 */
class QueueError extends Error {
    readonly type = 'QueueError' as const;
    constructor(
        message: string,
        public queueName: string,
        public description?: string
    ) {
        super(message);
        this.name = 'QueueError';
    }
    briefErrorString(): string {
        return `**${this.name}** at ${this.queueName}: ${this.message}`;
    }
}

/**
 * Error for not implemented commands
 */
class CommandNotImplementedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommandNotImplementedError';
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

/**
 * Error thrown during extension.load()
 */
class ExtensionSetupError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExtensionSetupError';
    }
    briefErrorString(): string {
        return `**${this.name}**: ${this.message}`;
    }
}

export {
    CommandParseError,
    ServerError,
    QueueError,
    CommandNotImplementedError,
    ExtensionSetupError
};
