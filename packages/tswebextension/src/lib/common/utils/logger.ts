import { LogLevel, Logger, getErrorMessage } from '@adguard/logger';
import { z as zod } from 'zod';

const logLevelSchema = zod.nativeEnum(LogLevel);
const verboseSchema = zod.boolean().optional();

/**
 * Extended logger with verbose option.
 */
export class ExtendedLogger extends Logger {
    /**
     * Sets verbose option.
     *
     * @param verbose Verbose option value.
     * @deprecated Verbose option will be removed, use {@link LogLevel.Mute} instead.
     * @throws Error if verbose flag is not a boolean.
     */
    public setVerbose(verbose?: boolean): void {
        this.currentLevel = verboseSchema.parse(verbose)
            ? LogLevel.Debug
            : LogLevel.Error;
    }
}

const logger = new ExtendedLogger();
logger.currentLevel = LogLevel.Error;

export {
    logger,
    LogLevel,
    logLevelSchema,
    verboseSchema,
    getErrorMessage,
};
