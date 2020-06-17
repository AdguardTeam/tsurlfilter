/**
 * Logger interface
 */
export interface ILogger {
    error(message?: string): void;
    warn(message?: string): void;
    log(message?: string): void;
    info(message?: string): void;
}

/**
 * Export logger implementation
 */
// eslint-disable-next-line import/no-mutable-exports
export let logger: ILogger = console;

/**
 * Set logger implementation
 *
 * @param loggerImpl
 */
export function setLogger(loggerImpl: ILogger): void {
    logger = loggerImpl;
}
