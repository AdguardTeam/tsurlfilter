import type { ConfigurationMV2Context } from './configuration';
import { sessionDecorator, SessionStorageKey } from './ext-session-storage';

/**
 * Top level app context storage.
 *
 * This context is needed to share data between other modules without cyclic dependencies.
 *
 * TODO (v.zhelvis) delete this context after DI is implemented.
 */
export class AppContext {
    /**
     * Is storage initialized.
     * This flag is used to prevent access to persistent storage data on
     * request from content script, before app is started.
     */
    public isStorageInitialized = false;

    /**
     * Is app started.
     */
    @sessionDecorator(SessionStorageKey.IsAppStarted)
    accessor isAppStarted!: boolean;

    /**
     * MV2 ConfigurationMV2 excludes heavyweight fields with rules.
     */
    @sessionDecorator(SessionStorageKey.Configuration)
    accessor configuration: ConfigurationMV2Context | undefined;
}

export const appContext = new AppContext();
