import { LogLevel, Logger, getErrorMessage } from '@adguard/logger';
import { z as zod } from 'zod';

const logLevelSchema = zod.nativeEnum(LogLevel);
const verboseSchema = zod.boolean();

/**
 * Extended logger with verbose option.
 */
class ExtendedLogger extends Logger {
    /**
     * Sets verbose option.
     *
     * @param verbose Verbose option value.
     * @deprecated Verbose option will be removed, use {@link LogLevel.Mute} instead.
     * @throws Error if verbose flag is not a boolean.
     */
    public setVerbose(verbose?: boolean): void {
        if (verbose) {
            this.currentLevel = LogLevel.Debug;
        } else {
            this.currentLevel = LogLevel.Info;
        }
    }
}

const logger = new ExtendedLogger();

export {
    logger,
    LogLevel,
    logLevelSchema,
    verboseSchema,
    getErrorMessage,
};
