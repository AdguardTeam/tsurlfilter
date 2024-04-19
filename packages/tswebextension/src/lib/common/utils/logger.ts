import { LogLevel, Logger, getErrorMessage } from '@adguard/logger';
import { z as zod } from 'zod';

const logLevelSchema = zod.enum(['mute', 'error', 'warn', 'info', 'debug']); // fixme: derive from LogLevel
const verboseSchema = zod.boolean();

const logger = new Logger();
logger.currentLevel = LogLevel.Debug;

export {
    logger,
    LogLevel,
    logLevelSchema,
    verboseSchema,
    getErrorMessage,
};
