import { LogLevel, Logger, getErrorMessage } from '@adguard/logger';

const logger = new Logger();
logger.currentLevel = LogLevel.Debug;

export { LogLevel, logger, getErrorMessage };
