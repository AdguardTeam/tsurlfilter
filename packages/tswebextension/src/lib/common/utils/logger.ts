/**
 * Logger interface.
 */
interface LoggerInterface {
    error(message?: string): void;
    warn(message?: string): void;
    debug(message?: string): void;
    info(message?: string): void;
}

export interface FlexibleLoggerInterface extends LoggerInterface {
    setVerbose(value: boolean): void;
}

/**
 * Export logger implementation.
 */
export class Logger implements FlexibleLoggerInterface {
    private verbose = false;

    private loggerImpl: LoggerInterface;

    /**
     * Logger constructor.
     *
     * @param loggerImpl Logger implementation to set, defaults to global console.
     */
    constructor(loggerImpl: LoggerInterface = console) {
        this.loggerImpl = loggerImpl;
    }

    /**
     * Sets verbose mode.
     *
     * @param value Boolean flag.
     */
    public setVerbose(value: boolean): void {
        this.verbose = value;
    }

    /**
     * Calls error method on logger implementation.
     *
     * @param message Log message.
     */
    public error(message?: string): void {
        this.loggerImpl.error(message);
    }

    /**
     * Calls warn method on logger implementation.
     *
     * @param message Log message.
     */
    public warn(message?: string): void {
        if (this.verbose) {
            this.loggerImpl.warn(message);
        }
    }

    /**
     * Calls debug method on logger implementation.
     *
     * @param message Log message.
     */
    public debug(message?: string): void {
        if (this.verbose) {
            this.loggerImpl.debug(message);
        }
    }

    /**
     * Calls info method on logger implementation.
     *
     * @param message Log message.
     */
    public info(message?: string): void {
        if (this.verbose) {
            this.loggerImpl.info(message);
        }
    }
}

export const logger = new Logger();
