import { type ConfigurationMV3Context } from './configuration';
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
     * MV3 ConfigurationMV3 excludes heavyweight fields with rules.
     */
    @sessionDecorator(SessionStorageKey.Configuration)
    accessor configuration: ConfigurationMV3Context | undefined;

    /**
     * Start time of the app.
     */
    @sessionDecorator(SessionStorageKey.StartTimeMs)
    accessor startTimeMs: number | undefined;

    /**
     * Flag that indicates that cosmetics were injected on startup.
     */
    @sessionDecorator(SessionStorageKey.CosmeticsInjectedOnStartup)
    accessor cosmeticsInjectedOnStartup!: boolean;

    /**
     * Hostnames with an active preregistered content script registration,
     * snapshotted when the service worker started (before the first sync of
     * this SW lifetime). Plain (non-persisted) field: a stale snapshot must
     * not survive an extension update that removes registrations.
     *
     * Used to decide whether a pre-existing tab could have received the
     * preregistered bundle at document_start (skip dynamic injection) or
     * not (force dynamic injection).
     */
    public preregisteredScriptIdsAtBoot?: Set<string>;
}

export const appContext = new AppContext();
