/* eslint-disable import/no-mutable-exports */
/**
 * Logger interface.
 */
export interface ILogger {
    error(message?: string): void;
    warn(message?: string): void;
    debug(message?: string): void;
    info(message?: string): void;
}

/**
 * Export logger implementation.
 */
export let logger: ILogger = console;

/**
 * Set logger implementation.
 *
 * @param loggerImpl The logger implementation to set.
 */
export function setLogger(loggerImpl: ILogger): void {
    logger = loggerImpl;
}
