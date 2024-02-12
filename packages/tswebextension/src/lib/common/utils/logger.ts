import { z as zod } from 'zod';

/**
 * Number presentation of log levels. Order is important. Higher number, more messages to be visible.
 */
const enum LogLevelWeight {
    Error = 1,
    Warn,
    Info,
    Debug,
}

export const logLevelSchema = zod.enum(['error', 'warn', 'info', 'debug']);

export const verboseSchema = zod.boolean();

export type LogLevel = zod.infer<typeof logLevelSchema>;

/**
 * Logger interface.
 */
export interface LoggerInterface {
    error(message?: string): void;
    warn(message?: string): void;
    debug(message?: string): void;
    info(message?: string): void;
}

/**
 * Export logger implementation.
 */
export class Logger implements LoggerInterface {
    private static readonly levelWeightMap: Record<LogLevel, LogLevelWeight> = {
        [logLevelSchema.enum.error]: LogLevelWeight.Error,
        [logLevelSchema.enum.warn]: LogLevelWeight.Warn,
        [logLevelSchema.enum.info]: LogLevelWeight.Info,
        [logLevelSchema.enum.debug]: LogLevelWeight.Debug,
    };

    /**
     * Verbose status.
     */
    private verbose: boolean = true;

    /**
     * Log level.
     */
    private logLevel: LogLevelWeight = LogLevelWeight.Error;

    private loggerImpl: LoggerInterface;

    /**
     * Logger constructor.
     *
     * @param loggerImpl Logger implementation to set, defaults to global console.
     */
    constructor(loggerImpl: LoggerInterface = console) {
        this.loggerImpl = loggerImpl;

        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.debug = this.debug.bind(this);
        this.info = this.info.bind(this);
    }

    /**
     * Sets log level weight from passed level name.
     * @param logLevelName Log level name.
     * @throws Error if log level name is not found.
     */
    public setLogLevel(logLevelName: LogLevel = logLevelSchema.enum.error): void {
        this.logLevel = logLevelSchema
            .transform((value) => Logger.levelWeightMap[value])
            .parse(logLevelName);
    }

    /**
     * Sets verbose option.
     * @param verbose Verbose boolean flag.
     * @throws Error if verbose flag is not a boolean.
     */
    public setVerbose(verbose = true): void {
        this.verbose = verboseSchema.parse(verbose);
    }

    /**
     * Calls error method on logger implementation.
     *
     * @param message Log message.
     */
    public error(message?: string): void {
        if (this.logLevel >= LogLevelWeight.Error) {
            this.loggerImpl.error(message);
        }
    }

    /**
     * Calls warn method on logger implementation.
     *
     * @param message Log message.
     */
    public warn(message?: string): void {
        if (this.verbose && this.logLevel >= LogLevelWeight.Warn) {
            this.loggerImpl.warn(message);
        }
    }

    /**
     * Calls debug method on logger implementation.
     *
     * @param message Log message.
     */
    public debug(message?: string): void {
        if (this.verbose && this.logLevel >= LogLevelWeight.Debug) {
            this.loggerImpl.debug(message);
        }
    }

    /**
     * Calls info method on logger implementation.
     *
     * @param message Log message.
     */
    public info(message?: string): void {
        if (this.verbose && this.logLevel >= LogLevelWeight.Info) {
            this.loggerImpl.info(message);
        }
    }
}

export const logger = new Logger();
