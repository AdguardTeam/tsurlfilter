import { logger } from '../../../common/utils/logger';
import { appContext } from '../app-context';
import { type PreregisteredScriptsConfig } from '../configuration';
import { type ContentScriptDescriptor, ContentScriptManager } from '../content-script-manager';
import { engineApi } from '../engine-api';

import {
    CLEANUP_FILENAME,
    computeRuleHashCached,
    expandHostnames,
    getRuleFilename,
    type PreregisteredScriptsManifest,
    SHARED_BUNDLE_FILENAME,
} from './hasher';
import { getHostnameScriptRules } from './hostname-rule-resolver';
import { readManifest } from './manifest-reader';
import { deriveCoverage, readActiveRegistrations, snapshotBootRegistrations } from './registrations-reader';

/**
 * Namespace for content script registration. Must be stable across sessions.
 */
export const PREREGISTERED_SCRIPTS_NAMESPACE = 'preregistered';

/**
 * Number of hostnames processed concurrently by
 * {@link PreregisteredScriptsService.buildDomainScripts}: bounds the fan-out
 * of `crypto.subtle` hashing when the hostname list grows.
 */
const HOST_LOOKUP_BATCH_SIZE = 8;

/**
 * Converts a hostname into a URL match pattern for `matches`.
 *
 * @param hostname Hostname string.
 *
 * @returns A single match pattern: `*://hostname/*`.
 */
const domainToMatchPatterns = (hostname: string): string[] => {
    return [`*://${hostname}/*`];
};

/**
 * Registers persistent (`persistAcrossSessions: true`) content scripts for
 * preregistered domains, so build-time-known scriptlet/JS rules run at
 * `document_start`, before the extension itself finishes starting up.
 *
 * `matchOriginAsFallback: true` makes the registrations cover
 * `about:blank`/srcdoc frames too: the dynamic path treats such frames as
 * covered by their nearest HTTP ancestor's hostname, so the preregistered
 * files must actually be injected there as well — otherwise the rules
 * would be suppressed on both paths.
 *
 * Hostnames not in the list keep the standard dynamic injection path.
 *
 * Known timing windows (accepted by design, self-healing on navigation):
 * - Documents are judged against the latest reported coverage, not the
 *   registrations they received at `document_start`: after a mid-lifetime
 *   sync, pages loaded before it may skip rules the sync added (missed
 *   execution) or re-run removed scriptlets (harmless — scriptlets are
 *   idempotent, and the dynamic path does not consult the coordination
 *   set, which `cleanup` deletes before page scripts run). Re-running a
 *   removed `#%#` JS rule is not harmless — see Known limitations.
 *   Pre-existing tabs are judged against the boot snapshot.
 *
 * Known limitations:
 * - Scriptlet executions are deduped by rule hash, unlike the dynamic
 *   path — both paths rely on scriptlets being idempotent.
 * - A page that started before a sync removed a `#%#` JS rule can execute
 *   it twice: the preregistered file already ran it, and the dynamic path
 *   runs it again because the coordination set dedupes only within one
 *   registration execution and `cleanup` deletes it before page scripts
 *   run. Arbitrary JS is not idempotent.
 * - `$url`-modified rules are never preregistered (the engine is queried
 *   per hostname root) and stay on the dynamic injection path.
 * - `$document`/`$jsinject` exceptions below the root path (e.g.
 *   `@@||youtube.com/embed/$jsinject`) do not cancel preregistration for
 *   the host: rules registered on `*://youtube.com/*` still execute on
 *   `/embed/…` — tracked in AG-54564.
 * - With protection disabled on a site (or in inverted allowlist mode),
 *   YouTube embeds on it still run these scriptlets: the registration
 *   covers every frame of the host, while the dynamic path would inject
 *   nothing there — tracked in AG-60054.
 */
export class PreregisteredScriptsService {
    /**
     * Serializes registration mutations — {@link PreregisteredScriptsService.sync}
     * and {@link PreregisteredScriptsService.clear} — so overlapping calls
     * cannot race on the shared content-script namespace.
     */
    private static syncQueue: Promise<unknown> = Promise.resolve();

    /**
     * Applies the configuration: snapshots the boot registrations once per
     * service-worker lifetime, then syncs them — or clears them when the
     * feature is not configured.
     *
     * Snapshot and mutation share one queue slot, so a concurrent init/stop
     * cannot interleave as `snapshot(A) -> clear(B) -> sync(A)`.
     *
     * @param preregistrationEnabled Whether preregistration should be active.
     * @param preregisteredScripts Build-time configuration, `undefined` when
     * the feature is not configured.
     */
    public static async init(
        preregistrationEnabled: boolean,
        preregisteredScripts?: PreregisteredScriptsConfig,
    ): Promise<void> {
        await PreregisteredScriptsService.enqueue(() => (
            PreregisteredScriptsService.applyConfiguration(
                preregistrationEnabled,
                preregisteredScripts,
            )
        ));
    }

    /**
     * Applies the configuration inside an already-held queue slot. Calls
     * `doSync()`/`clear` directly: the public `sync()`/`clear()` enqueue
     * themselves and would wait for the current slot.
     *
     * @param preregistrationEnabled Whether preregistration should be active.
     * @param preregisteredScripts Build-time configuration, `undefined` when
     * the feature is not configured.
     */
    private static async applyConfiguration(
        preregistrationEnabled: boolean,
        preregisteredScripts?: PreregisteredScriptsConfig,
    ): Promise<void> {
        await PreregisteredScriptsService.snapshotBootRegistrationsOnce();

        if (preregisteredScripts) {
            await PreregisteredScriptsService.doSync(
                preregistrationEnabled,
                preregisteredScripts.domains,
                preregisteredScripts.path,
            );

            return;
        }

        if (PreregisteredScriptsService.isNamespaceEmpty()) {
            appContext.preregisteredScriptRules = new Map();
            // Pre-existing pages already received the boot files at
            // document_start: keep their host set resolvable.
            appContext.preregisteredHostnames = new Set(
                appContext.preregisteredScriptRulesAtBoot?.keys() ?? [],
            );

            return;
        }

        await PreregisteredScriptsService.clearRegistrations();
    }

    /**
     * Returns true when this service worker has neither seen persisted
     * registrations at boot nor registered any script itself, so clearing
     * the namespace would only list an empty registry. A failed boot
     * snapshot never counts as empty: the registry may still hold persisted
     * registrations, so a clear attempt is required.
     *
     * @returns True when the namespace is known to be empty.
     */
    private static isNamespaceEmpty(): boolean {
        return !appContext.preregisteredScriptRulesAtBootFailed
            && appContext.preregisteredScriptRulesAtBoot?.size === 0
            && !appContext.preregisteredScriptsRegistered;
    }

    /**
     * Snapshots the persisted registrations once per service-worker
     * lifetime. A failed read fails open with an empty snapshot, so a later
     * retry does not judge pre-existing tabs against rules they never
     * received; the failure is remembered so the no-config path still
     * clears the possibly non-empty namespace.
     */
    private static async snapshotBootRegistrationsOnce(): Promise<void> {
        if (appContext.preregisteredScriptRulesAtBoot !== undefined) {
            return;
        }

        const succeeded = await snapshotBootRegistrations(PREREGISTERED_SCRIPTS_NAMESPACE);
        if (!succeeded) {
            appContext.preregisteredScriptRulesAtBootFailed = true;
            appContext.preregisteredScriptRulesAtBoot = new Map();
        }
    }

    /**
     * Clears the registrations and publishes the resulting coverage: empty
     * after success, the fallback (still-active registrations) after failure.
     */
    private static async clearRegistrations(): Promise<void> {
        try {
            await ContentScriptManager.clear(PREREGISTERED_SCRIPTS_NAMESPACE);
            appContext.preregisteredScriptsKey = undefined;
            appContext.preregisteredScriptsRegistered = false;
            appContext.preregisteredScriptRules = new Map();
            // Pre-existing pages already received the boot files at
            // document_start: keep their host set resolvable.
            appContext.preregisteredHostnames = new Set(
                appContext.preregisteredScriptRulesAtBoot?.keys() ?? [],
            );
            // The namespace is known to be empty now.
            appContext.preregisteredScriptRulesAtBootFailed = false;
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.clearRegistrations]: Failed to clear preregistered scripts', e);
            const fallback = PreregisteredScriptsService.getFallbackCoverage();
            appContext.preregisteredScriptRules = fallback;
            PreregisteredScriptsService.publishFallbackHostnames(fallback);
        }
    }

    /**
     * Tears down preregistration: drops the stored build-time configuration
     * synchronously (so a concurrent `reapplyGate()` cannot capture it and
     * enqueue an init that re-registers what stop removed), clears the
     * persisted registrations through the queue (so an in-flight sync
     * settles first), then resets the published coverage and the boot
     * snapshot.
     */
    public static async stop(): Promise<void> {
        appContext.preregisteredScripts = undefined;

        try {
            await PreregisteredScriptsService.clear();
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.stop]: Failed to clear preregistered scripts', e);

            // The persisted registrations are still active: keep their
            // coverage, otherwise the dynamic path re-injects every rule.
            appContext.preregisteredScriptRules = PreregisteredScriptsService.getFallbackCoverage();

            return;
        }

        appContext.preregisteredScriptRules = new Map();
        appContext.preregisteredScriptRulesAtBoot = undefined;
        appContext.preregisteredScriptRulesAtBootFailed = false;
        appContext.preregisteredHostnames = undefined;
    }

    /**
     * Re-applies the preregistration gate at runtime, using the build-time
     * configuration stored for the current service-worker lifetime.
     *
     * Does nothing until `configure()` has stored that configuration: it
     * stores it right after the engine starts, while a call without a
     * configuration makes {@link PreregisteredScriptsService.init} treat the
     * feature as disabled and clear the live registrations.
     *
     * @param preregistrationEnabled Whether preregistration should be active.
     */
    public static reapplyGate(preregistrationEnabled: boolean): void {
        const { preregisteredScripts } = appContext;
        if (!preregisteredScripts) {
            return;
        }

        PreregisteredScriptsService
            .init(preregistrationEnabled, preregisteredScripts)
            .catch((e) => {
                logger.error('[tsweb.PreregisteredScriptsService.reapplyGate]: Failed to re-evaluate preregistration', e);
            });
    }

    /**
     * Runs a registration mutation through {@link PreregisteredScriptsService.syncQueue},
     * so it cannot overlap with a queued sync or clear.
     *
     * @param operation Operation to run.
     *
     * @returns Promise resolving with the operation's result; rejects when
     * the operation fails.
     */
    private static enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const result = PreregisteredScriptsService.syncQueue.then(operation);
        PreregisteredScriptsService.syncQueue = result.catch(() => undefined);

        return result;
    }

    /**
     * Clears all persisted registrations of the namespace through the queue,
     * so a sync enqueued by a concurrent `configure()` cannot land between
     * the queue wait and the clear, nor run alongside it and re-register
     * what the clear just removed.
     *
     * @returns Promise resolving when the registrations are cleared;
     * rejects when clearing fails.
     */
    private static clear(): Promise<void> {
        return PreregisteredScriptsService.enqueue(async () => {
            await ContentScriptManager.clear(PREREGISTERED_SCRIPTS_NAMESPACE);
            appContext.preregisteredScriptsKey = undefined;
            appContext.preregisteredScriptsRegistered = false;
        });
    }

    /**
     * Returns the best-known coverage to publish when a sync or the clear
     * of the registrations failed: the last published coverage (its
     * registrations are still active), the boot snapshot before the first
     * sync, or an empty map. A failed post-sync read does NOT use this — it
     * publishes an empty map, since the registrations were already
     * replaced.
     *
     * @returns Hostname to covered rule hashes map.
     */
    private static getFallbackCoverage(): Map<string, Set<string>> {
        return appContext.preregisteredScriptRules
            ?? appContext.preregisteredScriptRulesAtBoot
            ?? new Map();
    }

    /**
     * Publishes the hostname set that describes the fallback coverage when a
     * sync/clear fails before the first successful publication. The already
     * published set is kept: it describes the registrations that are still
     * active. Without this, a failed first sync would republish coverage that
     * the dynamic path can never match, re-injecting rules the persisted
     * registrations already ran at `document_start`.
     *
     * @param coverage Coverage map that is being republished.
     */
    private static publishFallbackHostnames(coverage: Map<string, Set<string>>): void {
        if (appContext.preregisteredHostnames !== undefined) {
            return;
        }

        const configured = appContext.preregisteredScripts
            ? expandHostnames(appContext.preregisteredScripts.domains)
            : [];

        appContext.preregisteredHostnames = new Set(
            configured.length > 0 ? configured : coverage.keys(),
        );
    }

    /**
     * Builds a stable key for a descriptor set; the registry order is
     * irrelevant, so the descriptors are sorted by id.
     *
     * @param scripts Content-script descriptors.
     *
     * @returns Serializable descriptor-set key.
     */
    private static getScriptsKey(scripts: ContentScriptDescriptor[]): string {
        return JSON.stringify([...scripts].sort((a, b) => a.id.localeCompare(b.id)));
    }

    /**
     * Synchronizes preregistered content scripts with the current engine state.
     *
     * Unregisters everything when preregistration is disabled or no domains
     * are given. Safe to call repeatedly — diffs against current browser
     * registrations. Concurrent calls are serialized internally.
     *
     * @param preregistrationEnabled Whether preregistration should be active.
     * @param domains Configured preregistered domains: each is looked up
     * together with its `www.` alias (exact-host match patterns need both
     * entries); aliases without matching rules are skipped.
     * @param scriptsPath Extension-relative path to the preregistered scripts
     * directory (e.g. `filters/preregistered-scripts`).
     *
     * @returns Promise resolving with, per hostname, the hashes of the rules
     * with an active preregistered registration after the sync. Rules
     * cancelled by runtime `$path`/`$url` exceptions, missing from the
     * manifest, or whose registration failed are absent — they stay on the
     * dynamic injection path. The returned coverage is also published into
     * {@link appContext}. On sync failure the last published coverage is
     * republished (a failed sync leaves the previous registrations active,
     * and this is the set that describes them). On a failed post-sync read
     * the registrations were already replaced, so empty coverage is
     * published to avoid suppressing dynamic injection for rules with no
     * active registration.
     */
    public static async sync(
        preregistrationEnabled: boolean,
        domains: string[],
        scriptsPath: string,
    ): Promise<Map<string, Set<string>>> {
        return PreregisteredScriptsService.enqueue(() => {
            return PreregisteredScriptsService.doSync(
                preregistrationEnabled,
                domains,
                scriptsPath,
            );
        });
    }

    /**
     * Performs the actual sync and publishes its coverage; see
     * {@link PreregisteredScriptsService.sync}.
     *
     * @param preregistrationEnabled Whether preregistration should be active.
     * @param domains Configured preregistered domains.
     * @param scriptsPath Extension-relative path to the preregistered scripts
     * directory.
     *
     * @returns Promise resolving with the covered rule hashes per hostname.
     */
    private static async doSync(
        preregistrationEnabled: boolean,
        domains: string[],
        scriptsPath: string,
    ): Promise<Map<string, Set<string>>> {
        const hostnames = expandHostnames(domains);
        // The shared bundle embeds the host set of the generation it was
        // built for; prefer it over the runtime expansion so the page gate
        // and this predicate can never disagree about the set.
        let publishedHostnames: readonly string[] = hostnames;

        // A failure here leaves the previous registrations active, so the
        // last published coverage still describes them.
        let scripts: ContentScriptDescriptor[] = [];

        try {
            if (preregistrationEnabled && hostnames.length > 0) {
                const manifest = await readManifest(scriptsPath);
                publishedHostnames = manifest.hostnames ?? hostnames;
                scripts = await PreregisteredScriptsService.buildDomainScripts(
                    hostnames,
                    scriptsPath,
                    manifest,
                );
            }

            const scriptsKey = PreregisteredScriptsService.getScriptsKey(scripts);

            if (scriptsKey === appContext.preregisteredScriptsKey) {
                logger.debug('[tsweb.PreregisteredScriptsService.doSync]: Descriptors unchanged, skipping the sync');
            } else {
                appContext.preregisteredScriptsRegistered = true;
                const { errors } = await ContentScriptManager.sync(
                    PREREGISTERED_SCRIPTS_NAMESPACE,
                    scripts,
                );

                appContext.preregisteredScriptsKey = errors.length === 0
                    ? scriptsKey
                    : undefined;
                appContext.preregisteredScriptsRegistered = errors.length > 0 || scripts.length > 0;
            }
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.doSync]: Sync failed, keeping the previous coverage', e);

            const fallback = PreregisteredScriptsService.getFallbackCoverage();
            appContext.preregisteredScriptRules = fallback;
            PreregisteredScriptsService.publishFallbackHostnames(fallback);

            return fallback;
        }

        // The registrations now describe this hostname set; publish it for
        // the dynamic path's top-level check. A failed sync keeps the
        // previous registrations, so it keeps the previous set too. Published
        // even when preregistration is disabled: the boot snapshot may still
        // describe pre-existing pages, and the coverage map short-circuits
        // when there are no active registrations.
        appContext.preregisteredHostnames = new Set(publishedHostnames);

        // Report exactly what is registered, not what the sync attempted:
        // after a partial failure the browser still holds the previous
        // registration, so the built descriptors may not describe the
        // active set. A read failure means the registrations were already
        // replaced, so fail safe to empty coverage: dynamic injection then
        // re-runs everything instead of suppressing rules that have no
        // registration.
        try {
            const coveredRules = appContext.preregisteredScriptsKey === undefined
                ? await readActiveRegistrations(PREREGISTERED_SCRIPTS_NAMESPACE)
                : deriveCoverage(scripts);
            appContext.preregisteredScriptRules = coveredRules;

            logger.info(`[tsweb.PreregisteredScriptsService.doSync]: Synced preregistered scripts: ${coveredRules.size}/${hostnames.length} hostnames covered`);

            return coveredRules;
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.doSync]: Failed to read active registrations, reporting empty coverage', e);

            const empty = new Map<string, Set<string>>();
            appContext.preregisteredScriptRules = empty;

            return empty;
        }
    }

    /**
     * Builds MAIN-world content-script descriptors for the given hostnames,
     * each treated independently (no apex/`www.` expansion or union).
     *
     * Individual rules degrade to dynamic injection when cancelled by a
     * runtime `$path`/`$url` exception or absent from the manifest (no
     * generated file for them). A hostname with no surviving rules is not
     * registered.
     *
     * @param hostnames Preregistered hostnames (already normalized).
     * @param scriptsPath Extension-relative path to preregistered scripts.
     * @param manifest Build-time manifest.
     *
     * @returns Content-script descriptors for the covered hostnames. The
     * actual coverage is read separately from the active registrations.
     */
    private static async buildDomainScripts(
        hostnames: string[],
        scriptsPath: string,
        manifest: PreregisteredScriptsManifest,
    ): Promise<ContentScriptDescriptor[]> {
        const manifestHashes = new Set(manifest.hashes);
        const sharedBundlePath = `${scriptsPath}/${SHARED_BUNDLE_FILENAME}`;
        const cleanupPath = `${scriptsPath}/${CLEANUP_FILENAME}`;

        const scripts: ContentScriptDescriptor[] = [];
        const degradedRules = new Set<string>();
        const degradedHostnames = new Set<string>();
        let degradedHashFailures = 0;

        // Per-rule details go to debug; one warn summarizes the sync below.
        const logDegradedRule = (reason: string, hash: string, hostname: string): void => {
            degradedRules.add(hash);
            degradedHostnames.add(hostname);
            logger.debug(`[tsweb.PreregisteredScriptsService.buildDomainScripts]: Rule ${hash} on "${hostname}" ${reason}, keeping dynamic injection`);
        };

        // Process hostnames in bounded batches: the per-host engine match is
        // cheap, but the fan-out of `crypto.subtle` hashing must stay
        // bounded when the hostname list grows.
        for (let i = 0; i < hostnames.length; i += HOST_LOOKUP_BATCH_SIZE) {
            const batch = hostnames.slice(i, i + HOST_LOOKUP_BATCH_SIZE);

            // eslint-disable-next-line no-await-in-loop
            const batchHashFailures = await Promise.all(
                batch.map(async (hostname) => {
                    const rules = getHostnameScriptRules(hostname);
                    if (rules.length === 0) {
                        return 0;
                    }

                    const hashResults = await Promise.all(
                        rules.map(async (rule) => {
                            try {
                                return { rule, hash: await computeRuleHashCached(rule) };
                            } catch (e) {
                                logger.debug(`[tsweb.PreregisteredScriptsService.buildDomainScripts]: Failed to hash a rule for "${hostname}", keeping dynamic injection`, e);
                                return null;
                            }
                        }),
                    );

                    const failedHashCount = hashResults.filter((result) => result === null).length;
                    if (failedHashCount > 0) {
                        degradedHostnames.add(hostname);
                    }

                    const coveredHashes = new Set<string>();
                    const scriptletFunctionFiles = new Set<string>();

                    for (const hashResult of hashResults) {
                        if (!hashResult) {
                            continue;
                        }

                        const { rule, hash } = hashResult;

                        if (engineApi.isCosmeticRuleAllowlisted(
                            hostname,
                            rule,
                            { ignoreExceptionUrlConditions: true },
                        )) {
                            logDegradedRule(
                                'is cancelled by a runtime $path/$url exception',
                                hash,
                                hostname,
                            );
                            continue;
                        }

                        if (!manifestHashes.has(hash)) {
                            logDegradedRule('has no per-hash file', hash, hostname);
                            continue;
                        }

                        if (rule.isScriptlet) {
                            const scriptletName = rule.getScriptletData()?.params.name;
                            // `scriptletFiles` is a JSON-parsed plain object:
                            // a scriptlet named `__proto__`/`constructor` would
                            // resolve an inherited member and mark the rule as
                            // covered with a file that cannot exist.
                            const functionFile = scriptletName
                                && Object.hasOwn(manifest.scriptletFiles, scriptletName)
                                ? manifest.scriptletFiles[scriptletName]
                                : undefined;

                            if (!functionFile) {
                                logDegradedRule(
                                    'has no scriptlet function file',
                                    hash,
                                    hostname,
                                );
                                continue;
                            }

                            scriptletFunctionFiles.add(`${scriptsPath}/${functionFile}`);
                        }

                        coveredHashes.add(hash);
                    }

                    if (coveredHashes.size === 0) {
                        return failedHashCount;
                    }

                    const ruleFiles = [...coveredHashes]
                        .map((hash) => `${scriptsPath}/${getRuleFilename(hash)}`);
                    const js = [
                        sharedBundlePath,
                        ...[...scriptletFunctionFiles].sort(),
                        ...ruleFiles,
                        cleanupPath,
                    ];

                    scripts.push({
                        id: hostname,
                        js,
                        matches: domainToMatchPatterns(hostname),
                        runAt: 'document_start',
                        world: 'MAIN',
                        allFrames: true,
                        matchOriginAsFallback: true,
                        persistAcrossSessions: true,
                    });

                    return failedHashCount;
                }),
            );

            degradedHashFailures += batchHashFailures.reduce((sum, count) => sum + count, 0);
        }

        if (degradedHostnames.size > 0) {
            logger.warn(`[tsweb.PreregisteredScriptsService.buildDomainScripts]: ${degradedRules.size + degradedHashFailures} rule(s) on ${degradedHostnames.size} hostname(s) stay on dynamic injection, see debug logs for details`);
        }

        return scripts;
    }
}
