import { Logger, LogLevel } from '@adguard/logger';
import { type Configuration, TsWebExtension } from '@adguard/tswebextension/mv3';

export const logger = new Logger(console);
logger.currentLevel = LogLevel.Debug;

export const TS_WEB_EXTENSION = new TsWebExtension('/web-accessible-resources/redirects');

export const appState = {
    config: undefined as Configuration | undefined,
    isInitialized: false,
    isStarted: undefined as boolean | undefined,
    initializingPromise: undefined as Promise<void> | undefined,
};

export const DEFAULT_UX_CONFIG = {
    isStarted: true,
};
