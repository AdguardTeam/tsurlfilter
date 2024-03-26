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
}

/**
 * String presentation of log levels, for convenient users usage.
 */
export enum LogLevel {
    Error = 'error',
    Warn = 'warn',
    Info = 'info',
    Debug = 'debug',
}

/**
 * Log levels map, which maps number level to string level.
 */
const levelMapNumToString = {
    [LogLevelNumeric.Error]: LogLevel.Error,
    [LogLevelNumeric.Warn]: LogLevel.Warn,
    [LogLevelNumeric.Info]: LogLevel.Info,
    [LogLevelNumeric.Debug]: LogLevel.Debug,
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
 * Writer interface.
 */
export interface Writer {
    /**
     * Log method.
     * @param args
     */
    log: (...args: any[]) => void;
    /**
     * Info method.
     * @param args
     */
    info: (...args: any[]) => void;
    /**
     * Error method.
     * @param args
     */
    error: (...args: any[]) => void;
    // We do not print error, since in the extensions warn is counted as error.
    // warn: (...args: any[]) => void;
}

/**
 * Simple logger with log levels.
 */
export class Logger {
    private currentLevelValue = LogLevelNumeric.Info;

    private readonly writer: Writer;

    /**
     * Constructor.
     * @param writer Writer object.
     */
    constructor(writer: Writer = console) {
        this.writer = writer;
    }

    /**
     * Print debug messages. Usually used for technical information.
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
     * @returns Logger level.
     */
    public get currentLevel(): LogLevel {
        return levelMapNumToString[this.currentLevelValue];
    }

    /**
     * Setter for log level. With this method log level can be updated dynamically.
     *
     * @param logLevel Logger level.
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
     * @private
     * @returns Error message.
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

            if (typeof value.message === 'string') {
                return value.message;
            }

            if (typeof value === 'object') {
                return JSON.stringify(value);
            }

            return String(value);
        });

        const formattedTime = `${formatTime(new Date())}:`;

        this.writer[method](formattedTime, ...formattedArgs);
    }
}
