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
import { readActiveRegistrations, snapshotBootRegistrations } from './registrations-reader';

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
 * A frame is covered only when the top-level site belongs to the
 * preregistered host set: the filtering state (allowlist, inverted
 * allowlist) is tab-level, so the shared bundle installs a no-op shim when
 * the top-level origin (`location.ancestorOrigins`) is outside the set, and
 * the dynamic path applies the same rule to the published coverage.
 * Third-party embeds under a foreign top therefore stay on the dynamic path,
 * which can see the embedding site's filtering state. See the CSP-sandbox
 * limitation below.
 *
 * Known timing windows (accepted by design, self-healing on navigation):
 * - Documents are judged against the latest reported coverage, not the
 *   registrations they received at `document_start`: after a mid-lifetime
 *   sync, pages loaded before it may skip rules the sync added (missed
 *   execution) or re-run rules it removed (harmless — scriptlets are
 *   idempotent, and the dynamic path does not consult the coordination
 *   set, which `cleanup` deletes before page scripts run). Pre-existing
 *   tabs are judged against the boot snapshot.
 *
 * Known limitations:
 * - Scriptlet executions are deduped by rule hash, unlike the dynamic
 *   path — both paths rely on scriptlets being idempotent.
 * - `$url`-modified rules are never preregistered (the engine is queried
 *   per hostname root) and stay on the dynamic injection path.
 * - `$document`/`$jsinject` exceptions below the root path (e.g.
 *   `@@||youtube.com/embed/$jsinject`) do not cancel preregistration for
 *   the host: rules registered on `*://youtube.com/*` still execute on
 *   `/embed/…` — tracked in AG-54564.
 * - A top-level document with an opaque origin (e.g. a CSP sandbox) is
 *   rejected by the page gate, while the background still sees its URL, so
 *   the two predicates may disagree for such a tab.
 */
export class PreregisteredScriptsService {
    /**
     * Serializes registration mutations — {@link PreregisteredScriptsService.sync}
     * and {@link PreregisteredScriptsService.clear} — so overlapping calls
     * cannot race on the shared content-script namespace.
     */
    private static syncQueue: Promise<unknown> = Promise.resolve();

    /**
     * Initializes the feature for the current configuration: snapshots the
     * persisted registrations once per service-worker lifetime (used to
     * decide dynamic injection for pre-existing tabs), then syncs them — or
     * clears all when the feature is not configured, since persisted
     * registrations would otherwise keep firing across browser sessions.
     * Both operations publish the resulting coverage and hostname set into
     * {@link appContext}.
     *
     * @param preregistrationEnabled Whether preregistration should be active
     * (the caller composes it from `filteringEnabled && !debugScriptlets`).
     * @param preregisteredScripts Build-time preregistered script
     * configuration, or `undefined` when the feature is not configured.
     */
    public static async init(
        preregistrationEnabled: boolean,
        preregisteredScripts?: PreregisteredScriptsConfig,
    ): Promise<void> {
        // Snapshot before sync/clear mutates the registrations — through the
        // queue, so a concurrent init cannot read the pre-sync state after
        // the registrations were already replaced — so pre-existing tabs are
        // judged against the registrations that existed when their pages
        // loaded, not against the ones this service worker installs. Failure
        // handling: see snapshotBootRegistrations().
        await PreregisteredScriptsService.enqueue(async () => {
            if (appContext.preregisteredScriptRulesAtBoot === undefined) {
                await snapshotBootRegistrations(PREREGISTERED_SCRIPTS_NAMESPACE);
            }
        });

        if (preregisteredScripts) {
            await PreregisteredScriptsService.sync(
                preregistrationEnabled,
                preregisteredScripts.domains,
                preregisteredScripts.path,
            );

            return;
        }

        try {
            await PreregisteredScriptsService.clear();
            // A successful clear invalidates the published coverage: a later
            // failed sync would otherwise republish stale covered hashes and
            // suppress dynamic injection for rules with no active
            // registration. The hostname set keeps the boot snapshot's hosts:
            // pre-existing pages already received those files at
            // document_start, and the boot coverage must stay resolvable for
            // them.
            appContext.preregisteredScriptRules = new Map();
            appContext.preregisteredHostnames = new Set(
                appContext.preregisteredScriptRulesAtBoot?.keys() ?? [],
            );
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.init]: Failed to clear preregistered scripts', e);
            const fallback = PreregisteredScriptsService.getFallbackCoverage();
            appContext.preregisteredScriptRules = fallback;
            PreregisteredScriptsService.publishFallbackHostnames(fallback);
        }
    }

    /**
     * Tears down preregistration: clears the persisted registrations through
     * the queue (so an in-flight sync settles first), then resets the
     * published coverage and the boot snapshot, so the dynamic path fully
     * takes over after the app stops. Without the clear,
     * `persistAcrossSessions` registrations would keep firing at
     * `document_start` and survive browser sessions.
     */
    public static async stop(): Promise<void> {
        try {
            await PreregisteredScriptsService.clear();
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.stop]: Failed to clear preregistered scripts', e);
        }

        appContext.preregisteredScriptRules = new Map();
        appContext.preregisteredScriptRulesAtBoot = undefined;
        appContext.preregisteredHostnames = undefined;
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
        return PreregisteredScriptsService.enqueue(
            () => ContentScriptManager.clear(PREREGISTERED_SCRIPTS_NAMESPACE),
        );
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
     * sync/clear fails before the first successful publication. The
     * previously published set is kept when it exists: it describes the
     * registrations that are still active. Without this, a failed first sync
     * would republish coverage that the dynamic path can never match against
     * the (missing) host set, re-injecting rules the persisted registrations
     * already ran at `document_start`.
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
     * cancelled by runtime `$path` exceptions, missing from the manifest, or
     * whose registration failed are absent — they stay on the dynamic
     * injection path. The returned coverage is also published into
     * {@link appContext}, together with the artifact hostname set (the
     * manifest's when present). On sync failure the last published coverage
     * is republished (a failed sync leaves the previous registrations active,
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

        // Sync attempt. A failure here leaves the previous registrations
        // active, so the last published coverage still describes them.
        try {
            let scripts: ContentScriptDescriptor[] = [];

            if (preregistrationEnabled && hostnames.length > 0) {
                const manifest = await readManifest(scriptsPath);
                publishedHostnames = manifest.hostnames ?? hostnames;
                scripts = await PreregisteredScriptsService.buildDomainScripts(
                    hostnames,
                    scriptsPath,
                    manifest,
                );
            }

            await ContentScriptManager.sync(PREREGISTERED_SCRIPTS_NAMESPACE, scripts);
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.doSync]: Sync failed, keeping the previous coverage', e);

            const fallback = PreregisteredScriptsService.getFallbackCoverage();
            appContext.preregisteredScriptRules = fallback;
            PreregisteredScriptsService.publishFallbackHostnames(fallback);

            return fallback;
        }

        // The registrations now describe this hostname set; publish it for
        // the dynamic path's ancestor-chain check. A failed sync keeps the
        // previous registrations, so it keeps the previous set too. Published
        // even when preregistration is disabled: the boot snapshot may still
        // describe pre-existing pages, and the coverage map short-circuits
        // when there are no active registrations.
        appContext.preregisteredHostnames = new Set(publishedHostnames);

        // Report exactly what is registered, not what the sync attempted:
        // failed updates leave the previous registration active, and the
        // boot snapshot only describes pre-existing documents.
        // A read failure is different from a sync failure — the
        // registrations were already replaced, so the last published
        // coverage no longer matches what is active. Fail safe to empty
        // coverage: dynamic injection then re-runs everything, which is
        // harmless, instead of suppressing rules that have no registration.
        try {
            const coveredRules = await readActiveRegistrations(PREREGISTERED_SCRIPTS_NAMESPACE);
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

        // Per-rule details go to debug; one warn summarizes the sync below.
        const logDegradedRule = (reason: string, hash: string, hostname: string): void => {
            degradedRules.add(hash);
            degradedHostnames.add(hostname);
            // eslint-disable-next-line max-len
            logger.debug(`[tsweb.PreregisteredScriptsService.buildDomainScripts]: Rule ${hash} on "${hostname}" ${reason}, keeping dynamic injection`);
        };

        // Process hostnames in bounded batches: the per-host engine match is
        // cheap, but the fan-out of `crypto.subtle` hashing must stay
        // bounded when the hostname list grows.
        for (let i = 0; i < hostnames.length; i += HOST_LOOKUP_BATCH_SIZE) {
            const batch = hostnames.slice(i, i + HOST_LOOKUP_BATCH_SIZE);

            // eslint-disable-next-line no-await-in-loop
            await Promise.all(
                batch.map(async (hostname) => {
                    const rules = getHostnameScriptRules(hostname);
                    if (rules.length === 0) {
                        return;
                    }

                    const hashResults = await Promise.all(
                        rules.map(async (rule) => {
                            try {
                                return { rule, hash: await computeRuleHashCached(rule) };
                            } catch (e) {
                                logger.error(
                                    // eslint-disable-next-line max-len
                                    `[tsweb.PreregisteredScriptsService.buildDomainScripts]: Failed to hash a rule for "${hostname}"`,
                                    e,
                                );
                                return null;
                            }
                        }),
                    );

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
                            const functionFile = scriptletName
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
                        return;
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
                }),
            );
        }

        if (degradedHostnames.size > 0) {
            // eslint-disable-next-line max-len
            logger.warn(`[tsweb.PreregisteredScriptsService.buildDomainScripts]: ${degradedRules.size} rule(s) on ${degradedHostnames.size} hostname(s) stay on dynamic injection, see debug logs for details`);
        }

        return scripts;
    }
}
