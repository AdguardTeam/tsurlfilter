/**
 * Logger interface.
 */
export interface ILogger {
    error(message?: string, ...args: unknown[]): void
    warn(message?: string, ...args: unknown[]): void;
    debug(message?: string, ...args: unknown[]): void
    info(message?: string, ...args: unknown[]): void;
}

/**
 * Export logger implementation.
 */
export const logger: ILogger = console;
