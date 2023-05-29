import { LogLevelEnum, LogLevelType, LogLevelName } from '../configuration';
import { appContext } from '../../mv2/background/context';
// TODO (v.zhelvis) move app context to common and make it generic.

const DEFAULT_VERBOSE_FLAG = true;
const DEFAULT_LOG_LEVEL: LogLevelType = LogLevelEnum.enum.Error;

/**
 * Number presentation of log levels. Order is important. Higher number, more messages to be visible.
 */
const enum LogLevelWeight {
    Error = 1,
    Warn,
    Info,
    Debug,
}

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
    /**
     * Gets app verbose status.
     *
     * TODO (v.zhelvis) remove eslint rule after passing appContext the right way.
     *
     * @returns App verbose status.
     */
    // eslint-disable-next-line class-methods-use-this
    private get verbose(): boolean {
        return appContext.configuration?.verbose ?? DEFAULT_VERBOSE_FLAG;
    }

    /**
     * Gets app log level.
     *
     * TODO (v.zhelvis) remove eslint rule after passing appContext the right way.
     *
     * @returns Log level.
     */
    // eslint-disable-next-line class-methods-use-this
    private get logLevel(): LogLevelWeight {
        const logLevelString = appContext.configuration?.logLevel ?? DEFAULT_LOG_LEVEL;

        switch (logLevelString) {
            case LogLevelEnum.enum.Error:
                return LogLevelWeight.Error;
            case LogLevelEnum.enum.Warn:
                return LogLevelWeight.Warn;
            case LogLevelEnum.enum.Info:
                return LogLevelWeight.Info;
            case LogLevelEnum.enum.Debug:
                return LogLevelWeight.Debug;
            default:
                throw new Error(`Logger only supports following levels: ${[Object.values(LogLevelName).join(', ')]}`);
        }
    }

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
