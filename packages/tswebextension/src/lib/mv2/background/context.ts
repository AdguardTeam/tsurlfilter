import type { ConfigurationMV2Context } from './configuration';

/**
 * Top level app context storage.
 *
 * This context is needed to share data between other modules without cyclic dependencies.
 *
 * TODO (v.zhelvis) move app context to common and make it generic.
 */
export class AppContext {
    /**
     * Is app started.
     */
    isAppStarted = false;

    /**
     * MV2 ConfigurationMV2 excludes heavyweight fields with rules.
     */
    configuration: ConfigurationMV2Context | undefined;
}

export const appContext = new AppContext();
