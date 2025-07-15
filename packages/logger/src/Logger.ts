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
    Verbose,
}

/**
 * String presentation of log levels, for convenient users usage.
 * Ordered in the same way as LogLevelNumeric.
 *
 * First three levels will be shown to users, and the last two are for developers.
 */
export enum LogLevel {
    /**
     * For errors.
     */
    Error = 'error',
    /**
     * For not critical errors.
     */
    Warn = 'warn',
    /**
     * For important information.
     * Use for general operational messages.
     */
    Info = 'info',
    /**
     * For debugging purposes, e.g. Inside conditions, loops or some edge cases.
     */
    Debug = 'debug',
    /**
     * For ultra-detailed, step-by-step traces (like stack traces or flow tracking).
     */
    Verbose = 'verbose',
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
    [LogLevelNumeric.Verbose]: LogLevel.Verbose,
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
export enum LogMethod {
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
        this.print(LogLevelNumeric.Verbose, LogMethod.Trace, args);
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
     */
    private static errorToString(error: Error): string {
        const message = getErrorMessage(error);
        return `${message}\nStack trace:\n${error.stack}`;
    }

    /**
     * Prints error message with stack trace.
     * It prints the message with the stack trace in a collapsed group.
     * This is useful for debugging purposes, as it allows to see the stack trace
     * without cluttering the console with too many messages.
     *
     * @param formattedTime Formatted time.
     * @param formattedArgs Formatted arguments.
     */
    private printWithStackTrace(
        formattedTime: string,
        formattedArgs: any[],
    ): void {
        // If grouping is not supported, print just expanded trace, but this
        // leads to a lot of dirty logs in the console, since the stack trace
        // will be printed for every message.
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

    /**
     * Wrapper over log methods.
     *
     * @param level Logger level.
     * @param method Logger method.
     * @param args Printed arguments.
     */
    private print(
        level: LogLevelNumeric,
        method: LogMethod,
        args: any[],
    ): void {
        // Skip writing if the basic conditions are not met.
        if (this.currentLevelValue < level) {
            return;
        }

        // Do not print if no arguments are passed.
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
         * If current log level is Debug or Verbose, print all channels with stack
         * trace via using writer.trace method to help identify the location of the
         * log.
         *
         * Exception is Error method, because it is already contains build-in
         * stack trace.
         */
        if (
            this.currentLevelValue >= levelMapStringToNum[LogLevel.Debug]
            && method !== LogMethod.Error
        ) {
            this.printWithStackTrace(formattedTime, formattedArgs);
            return;
        }

        // Otherwise just print with requested method of writer.
        this.writer[method](formattedTime, ...formattedArgs);
    }
}
