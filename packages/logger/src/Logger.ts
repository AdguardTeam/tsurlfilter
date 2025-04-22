import { getErrorMessage } from './error';
import { formatTime } from './format-time';

/**
 * Number presentation of log levels. Order is important. Higher number, more messages to be visible.
 */
export const enum LogLevelNumeric {
    Error = 1,
    Warn,
    Info,
    Debug,
    Trace,
}

/**
 * String presentation of log levels, for convenient users usage.
 * Ordered in the same way as LogLevelNumeric.
 */
export enum LogLevel {
    Error = 'error',
    Warn = 'warn',
    Info = 'info',
    Debug = 'debug',
    Trace = 'trace',
}

/**
 * Log levels map, which maps number level to string level.
 * Ordered in the same way as LogLevelNumeric.
 */
const levelMapNumToString = {
    [LogLevelNumeric.Error]: LogLevel.Error,
    [LogLevelNumeric.Warn]: LogLevel.Warn,
    [LogLevelNumeric.Info]: LogLevel.Info,
    [LogLevelNumeric.Debug]: LogLevel.Debug,
    [LogLevelNumeric.Trace]: LogLevel.Trace,
};

/**
 * Log levels map, which maps string level to number level.
 */
const levelMapStringToNum: Record<string, LogLevelNumeric> = Object.entries(levelMapNumToString)
    .reduce((acc, [key, value]) => {
    // Here, key is originally a string since Object.entries() returns [string, string][].
    // We need to cast the key to LogLevelNumeric correctly without causing type mismatches.
        const numericKey = Number(key) as LogLevelNumeric;
        if (!Number.isNaN(numericKey)) {
            acc[value] = numericKey;
        }
        return acc;
    }, {} as Record<string, LogLevelNumeric>);

/**
 * Methods supported by console. Used to manage levels.
 * Ordered in the same way as LogLevelNumeric.
 */
export const enum LogMethod {
    Error = 'error',
    Warn = 'warn',
    Info = 'info',
    Debug = 'debug',
    Trace = 'trace',
}

/**
 * Writer method.
 *
 * @param {...any} args Arguments list to log.
 */
export type WriterMethod = (...args: any[]) => void;

/**
 * Writer interface.
 */
export interface Writer {
    /**
     * Error method.
     */
    error: WriterMethod;

    /**
     * Warn method.
     */
    warn: WriterMethod;

    /**
     * Info method.
     */
    info: WriterMethod;

    /**
     * Debug method.
     */
    debug: WriterMethod;

    /**
     * Trace method.
     */
    trace: WriterMethod;

    /**
     * Group collapsed method.
     */
    groupCollapsed?: WriterMethod;

    /**
     * Group end method.
     */
    groupEnd?: WriterMethod;
}

/**
 * Simple logger with log levels.
 */
export class Logger {
    private currentLevelValue = LogLevelNumeric.Info;

    private readonly writer: Writer;

    /**
     * Constructor.
     *
     * @param writer Writer object.
     */
    constructor(writer: Writer = console) {
        this.writer = writer;

        // bind the logging methods to avoid losing context
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.info = this.info.bind(this);
        this.debug = this.debug.bind(this);
        this.trace = this.trace.bind(this);
    }

    /**
     * Print error messages.
     * Use when something went wrong.
     *
     * @param args Printed arguments.
     */
    public error(...args: unknown[]): void {
        this.print(LogLevelNumeric.Error, LogMethod.Error, args);
    }

    /**
     * Print warn messages.
     * Use when Something might go wrong.
     *
     * @param args Printed arguments.
     */
    public warn(...args: unknown[]): void {
        this.print(LogLevelNumeric.Warn, LogMethod.Warn, args);
    }

    /**
     * Print messages you want to disclose to users.
     * Use for general operational messages.
     *
     * @param args Printed arguments.
     */
    public info(...args: unknown[]): void {
        this.print(LogLevelNumeric.Info, LogMethod.Info, args);
    }

    /**
     * Print debug messages. Usually used for technical information.
     *
     * @param args Printed arguments.
     */
    public debug(...args: unknown[]): void {
        this.print(LogLevelNumeric.Debug, LogMethod.Debug, args);
    }

    /**
     * Print trace messages.
     * Ultra-detailed, step-by-step traces (like stack traces or flow tracking).
     *
     * @param args Printed arguments.
     */
    public trace(...args: unknown[]): void {
        this.print(LogLevelNumeric.Trace, LogMethod.Trace, args);
    }

    /**
     * Getter for log level.
     *
     * @returns Logger level.
     */
    public get currentLevel(): LogLevel {
        return levelMapNumToString[this.currentLevelValue];
    }

    /**
     * Setter for log level. With this method log level can be updated dynamically.
     *
     * @param logLevel Logger level.
     *
     * @throws Error if log level is not supported.
     */
    public set currentLevel(logLevel: LogLevel) {
        const level = levelMapStringToNum[logLevel];
        if (level === undefined) {
            throw new Error(`Logger supports only the following levels: ${[Object.values(LogLevel).join(', ')]}`);
        }
        this.currentLevelValue = level;
    }

    /**
     * Converts error to string, and adds stack trace.
     *
     * @param error Error to print.
     *
     * @returns Error message.
     *
     * @private
     */
    private static errorToString(error: Error): string {
        const message = getErrorMessage(error);
        return `${message}\nStack trace:\n${error.stack}`;
    }

    /**
     * Wrapper over log methods.
     *
     * @param level Logger level.
     * @param method Logger method.
     * @param args Printed arguments.
     *
     * @private
     */
    private print(
        level: LogLevelNumeric,
        method: LogMethod,
        args: any[],
    ): void {
        // skip writing if the basic conditions are not met
        if (this.currentLevelValue < level) {
            return;
        }
        if (!args || args.length === 0 || !args[0]) {
            return;
        }

        const formattedArgs = args.map((value) => {
            if (value instanceof Error) {
                return Logger.errorToString(value);
            }

            if (value && typeof value.message === 'string') {
                return value.message;
            }

            if (typeof value === 'object' && value !== null) {
                return JSON.stringify(value);
            }

            return String(value);
        });

        const formattedTime = `${formatTime(new Date())}:`;

        /**
         * Conditions in which trace can happen:
         * 1. Method is not error (because console.error provides call stack trace)
         * 2. Log level is equal or higher that `LogLevel.Trace`.
         */
        if (
            method === LogMethod.Error
            || this.currentLevelValue < levelMapStringToNum[LogLevel.Trace]
        ) {
            // Print with regular method
            this.writer[method](formattedTime, ...formattedArgs);
            return;
        }

        if (!this.writer.groupCollapsed || !this.writer.groupEnd) {
            // Print expanded trace
            this.writer.trace(formattedTime, ...formattedArgs);
            return;
        }

        // Print collapsed trace to make logs more readable and access to stack
        // trace by clicking on the group.
        this.writer.groupCollapsed(formattedTime, ...formattedArgs);
        this.writer.trace();
        this.writer.groupEnd();
    }
}
