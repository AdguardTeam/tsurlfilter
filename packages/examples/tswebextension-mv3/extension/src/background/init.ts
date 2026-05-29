import { type Configuration } from '@adguard/tswebextension/mv3';

import { EXTENSION_INITIALIZED_EVENT } from '../common/constants';

import { loadDefaultConfig } from './loadDefaultConfig';
import { appState, DEFAULT_UX_CONFIG, logger, TS_WEB_EXTENSION } from './state';
import { storage, StorageKeys } from './storage';

/**
 * Loads config from storage or creates a default one.
 */
const loadAndPersistConfig = async (): Promise<void> => {
    if (appState.config) {
        return;
    }

    const saved = await storage.get<Configuration>(StorageKeys.Config);

    appState.config = saved ?? loadDefaultConfig();

    if (!saved) {
        await storage.set(StorageKeys.Config, appState.config);
    }
};

/**
 * Restores or initialises the started flag, then starts the engine if needed.
 */
const ensureIsStarted = async (): Promise<void> => {
    if (appState.isStarted !== undefined) {
        return;
    }

    const saved = await storage.get<boolean>(StorageKeys.IsStarted);
    appState.isStarted = saved ?? DEFAULT_UX_CONFIG.isStarted;

    if (saved === undefined) {
        await storage.set(StorageKeys.IsStarted, appState.isStarted);
    }

    if (appState.isStarted) {
        await TS_WEB_EXTENSION.start(appState.config!);
    }
};

const markInitialized = () => {
    appState.isInitialized = true;
    appState.initializingPromise = undefined;
    dispatchEvent(new Event(EXTENSION_INITIALIZED_EVENT));
};

/**
 * One-shot initialisation: loads config, starts the engine, fires the
 * EXTENSION_INITIALIZED_EVENT.  Safe to call concurrently — later callers
 * wait for the first invocation.
 */
export const initializeExtension = async (caller?: string): Promise<void> => {
    await loadAndPersistConfig();

    if (appState.initializingPromise) {
        logger.debug('[tswebexample.init]: waiting for init', caller);
        await appState.initializingPromise;
        return;
    }

    if (appState.isInitialized) {
        return;
    }

    logger.debug('[tswebexample.init]: start init', caller);

    appState.initializingPromise = ensureIsStarted();
    await appState.initializingPromise;

    markInitialized();
};
