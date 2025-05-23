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
 */
export const enum LogMethod {
    Log = 'log',
    Info = 'info',
    Error = 'error',
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
     * Log method.
     *
     * @param args
     */
    log: WriterMethod;

    /**
     * Info method.
     *
     * @param args
     */
    info: WriterMethod;

    /**
     * Error method.
     *
     * @param args
     */
    error: WriterMethod;

    /**
     * Trace method.
     *
     * @param args
     */
    trace?: WriterMethod;

    /**
     * Group collapsed method.
     *
     * @param args
     */
    groupCollapsed?: WriterMethod;

    /**
     * Group end method.
     *
     * @param args
     */
    groupEnd?: WriterMethod;

    // We do not use 'warn' channel, since in the extensions warn is counted as error.
    // warn: WriterMethod;
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
        this.debug = this.debug.bind(this);
        this.info = this.info.bind(this);
        this.warn = this.warn.bind(this);
        this.error = this.error.bind(this);
    }

    /**
     * Print debug messages. Usually used for technical information.
     * Will be printed in 'log' channel.
     *
     * @param args Printed arguments.
     */
    public debug(...args: unknown[]): void {
        this.print(LogLevelNumeric.Debug, LogMethod.Log, args);
    }

    /**
     * Print messages you want to disclose to users.
     *
     * @param args Printed arguments.
     */
    public info(...args: unknown[]): void {
        this.print(LogLevelNumeric.Info, LogMethod.Info, args);
    }

    /**
     * Print warn messages.
     * NOTE: We do not use 'warn' channel, since in the extensions warn is
     * counted as error. Instead of this we use 'info' channel.
     *
     * @param args Printed arguments.
     */
    public warn(...args: unknown[]): void {
        this.print(LogLevelNumeric.Warn, LogMethod.Info, args);
    }

    /**
     * Print error messages.
     *
     * @param args Printed arguments.
     */
    public error(...args: unknown[]): void {
        this.print(LogLevelNumeric.Error, LogMethod.Error, args);
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
         * 3. Writer has `trace` method.
         */
        if (
            method === LogMethod.Error
            || this.currentLevelValue < levelMapStringToNum[LogLevel.Trace]
            || !this.writer.trace
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

        // Print collapsed trace
        this.writer.groupCollapsed(formattedTime, ...formattedArgs);
        this.writer.trace();
        this.writer.groupEnd();
    }
}
