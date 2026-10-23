import { type ConfigurationMV3Context, type PreregisteredScriptsConfig } from './configuration';
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
     * Build-time preregistered script configuration, kept because the stored
     * configuration context excludes it: preregistration is re-evaluated
     * when the filtering log toggles debug scriptlets at runtime.
     */
    public preregisteredScripts?: PreregisteredScriptsConfig;

    /**
     * Per-hostname hashes of rules covered by the currently active
     * preregistered content-script registrations, recovered from their `js`
     * file lists. Published by `PreregisteredScriptsService` on every
     * sync/clear; dynamic injection of covered rules is skipped to avoid
     * double execution. Hostname semantics match the content-script match
     * patterns exactly: a `www.` alias does not cover the apex. Plain
     * (non-persisted) field.
     */
    public preregisteredScriptRules?: Map<string, Set<string>>;

    /**
     * Normalized hostnames of the preregistered artifact generation: the
     * shared bundle's embed-gate set (the build manifest is preferred over
     * the runtime expansion). A frame is covered only when the top-level site
     * belongs to this set, so an embed under a foreign top stays on the
     * dynamic injection path. Plain (non-persisted) field: it lives for one
     * service-worker lifetime.
     */
    public preregisteredHostnames?: Set<string>;

    /**
     * Per-hostname hashes of rules covered by preregistered content-script
     * registrations that existed when the service worker started (before
     * the first sync of this SW lifetime), recovered from the registrations'
     * `js` file lists. Chrome clears registrations on install and update,
     * so the snapshot can only describe registrations persisted from
     * previous service-worker lifetimes of the current version. Plain
     * (non-persisted) field: it lives for one service-worker lifetime.
     *
     * Used to decide which rules are covered for a pre-existing tab (skip
     * dynamic injection) and which are not (inject dynamically).
     */
    public preregisteredScriptRulesAtBoot?: Map<string, Set<string>>;

    /**
     * Whether the boot snapshot read failed. A failed read leaves an empty
     * snapshot, but an empty snapshot is not proof that the namespace is
     * empty: persisted registrations may still be active, so the no-config
     * path must still attempt a clear. Plain (non-persisted) field.
     */
    public preregisteredScriptRulesAtBootFailed?: boolean;

    /**
     * Descriptor-set key of the last successful preregistered sync: when
     * the next sync builds the same set, the browser-side diff and
     * scripting calls are skipped. Plain (non-persisted) field.
     */
    public preregisteredScriptsKey?: string;

    /**
     * Whether this service worker may have content scripts registered in
     * the preregistered namespace: set before a sync and cleared only after
     * a successful clear. Plain (non-persisted) field.
     */
    public preregisteredScriptsRegistered?: boolean;
}

export const appContext = new AppContext();
