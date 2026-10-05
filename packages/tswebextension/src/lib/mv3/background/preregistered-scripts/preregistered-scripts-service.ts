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
 * For each configured hostname (plus its derived `www.` alias) the service
 * queries the engine (ignoring `$path`, so path-qualified rules aren't
 * missed), hashes the matching rules and registers
 * `js: [bundle, ...scriptletFunctionFiles, ...perRuleFiles, cleanup]`.
 * Scriptlet function files carry only the implementations the host's rules
 * use (from the manifest's `scriptletFiles` map). The per-rule file itself
 * enforces any `$path` condition via `location`. `cleanup` runs last,
 * deleting the coordination `window` property before page scripts run.
 *
 * `matchOriginAsFallback: true` additionally covers `about:blank`/srcdoc
 * frames on these hosts, which the dynamic path never reaches — an
 * intentional behavior extension.
 *
 * Hostnames not in the list keep the standard dynamic injection path.
 *
 * Known timing windows (accepted by design, self-healing on navigation):
 * - Documents are judged against the latest reported coverage, not the
 *   registrations they received at `document_start`: after a mid-lifetime
 *   sync, pages loaded before it may skip rules the sync added (missed
 *   execution) or re-run rules it removed (harmless — the shared dedup
 *   set makes re-execution safe). Pre-existing tabs are judged against
 *   the boot snapshot.
 *
 * Known limitations:
 * - Scriptlet executions are deduped by rule hash, unlike the dynamic
 *   path — both paths rely on scriptlets being idempotent.
 * - `$url`-modified rules are never preregistered (the engine is queried
 *   per hostname root) and stay on the dynamic injection path.
 * - Preregistered executions bypass hit logging; they do appear in the
 *   filtering log, but the entries reflect the coverage decision, not the
 *   in-page execution outcome — a preregistered file failing inside the
 *   page is not observable.
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
     * registrations would otherwise survive forever. Both operations
     * publish the resulting coverage into {@link appContext}.
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
        // Snapshot unconditionally, before sync/clear mutates registrations,
        // so pre-existing tabs are judged against the registrations that
        // existed when their pages loaded — even when the feature is not
        // configured anymore (an update may have removed it). A failed
        // snapshot is NOT persisted into the app context, so the next
        // configure retries it instead of sticking with an empty map for
        // the rest of the service-worker lifetime.
        if (appContext.preregisteredScriptRulesAtBoot === undefined) {
            await snapshotBootRegistrations(PREREGISTERED_SCRIPTS_NAMESPACE);
        }

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
            // registration.
            appContext.preregisteredScriptRules = new Map();
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.init]: Failed to clear preregistered scripts', e);
            appContext.preregisteredScriptRules = PreregisteredScriptsService.getFallbackCoverage();
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
     * Returns the best-known coverage to publish when the active
     * registrations cannot be observed: the last published coverage (the
     * registrations it described are still active), or the boot snapshot
     * before the first sync, or an empty map.
     *
     * @returns Hostname to covered rule hashes map.
     */
    private static getFallbackCoverage(): Map<string, Set<string>> {
        return appContext.preregisteredScriptRules
            ?? appContext.preregisteredScriptRulesAtBoot
            ?? new Map();
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

        // Sync attempt. A failure here leaves the previous registrations
        // active, so the last published coverage still describes them.
        try {
            let scripts: ContentScriptDescriptor[] = [];

            if (preregistrationEnabled && hostnames.length > 0) {
                const manifest = await readManifest(scriptsPath);
                if (manifest) {
                    scripts = await PreregisteredScriptsService.buildDomainScripts(
                        hostnames,
                        scriptsPath,
                        manifest,
                    );
                }
            }

            await ContentScriptManager.syncDetailed(PREREGISTERED_SCRIPTS_NAMESPACE, scripts);
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.doSync]: Sync failed, keeping dynamic injection', e);

            const fallback = PreregisteredScriptsService.getFallbackCoverage();
            appContext.preregisteredScriptRules = fallback;

            return fallback;
        }

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
     * runtime `$path` exception or absent from the manifest (no generated
     * file for them). A hostname with no surviving rules is not registered.
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

                        if (engineApi.isCosmeticRuleAllowlisted(hostname, rule, { ignoreExceptionPath: true })) {
                            PreregisteredScriptsService.logDegradedRule(
                                'is cancelled by a runtime $path exception',
                                hash,
                                hostname,
                            );
                            continue;
                        }

                        if (!manifestHashes.has(hash)) {
                            PreregisteredScriptsService.logDegradedRule('has no per-hash file', hash, hostname);
                            continue;
                        }

                        if (rule.isScriptlet) {
                            const scriptletName = rule.getScriptletData()?.params.name;
                            const functionFile = scriptletName
                                ? manifest.scriptletFiles[scriptletName]
                                : undefined;

                            if (!functionFile) {
                                PreregisteredScriptsService.logDegradedRule(
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

        return scripts;
    }

    /**
     * Logs why a rule stays on the dynamic injection path.
     *
     * @param reason Human-readable reason (no trailing punctuation).
     * @param hash Rule hash.
     * @param hostname Hostname the rule was matched for.
     */
    private static logDegradedRule(reason: string, hash: string, hostname: string): void {
        // eslint-disable-next-line max-len
        logger.warn(`[tsweb.PreregisteredScriptsService.logDegradedRule]: Rule ${hash} on "${hostname}" ${reason}, keeping dynamic injection`);
    }
}
