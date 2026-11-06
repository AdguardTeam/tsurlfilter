import { FiltersStorage } from '../../../common/storage/filters';
import { logger } from '../../../common/utils/logger';
import { appContext } from '../app-context';
import { type PreregisteredScriptsConfig } from '../configuration';
import { type ContentScriptDescriptor, ContentScriptManager } from '../content-script-manager';
import { engineApi } from '../engine-api';

import { computePageExceptionsFingerprint, type PreregisteredFilterList } from './exception-fingerprint';
import {
    CLEANUP_FILENAME,
    computeRuleHashCached,
    expandHostnames,
    getConditionsFilename,
    getRuleFilename,
    type PreregisteredScriptsManifest,
    SHARED_BUNDLE_FILENAME,
} from './hasher';
import { getHostnameScriptRules } from './hostname-rule-resolver';
import { readManifest } from './manifest-reader';
import { deriveCoverage, readActiveRegistrations, snapshotBootRegistrations } from './registrations-reader';
import { findHostsWithRuntimeExceptions } from './runtime-exceptions';

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
 * A fingerprint computed by
 * {@link PreregisteredScriptsService.findStalePageExceptionFilters}, valid
 * while the list checksum and the covered host set stay the same.
 */
type CachedFingerprint = {
    /**
     * Checksum of the filter list the fingerprint was computed from.
     */
    checksum: string;

    /**
     * Covered hostnames, joined; a new host changes the scope.
     */
    hostnamesKey: string;

    /**
     * The fingerprint itself.
     */
    fingerprint: string;
};

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
 * What a sync registers for the shipped generation.
 */
type RegistrationPlan = {
    /**
     * Hostnames the descriptors cover.
     */
    registeredHostnames: readonly string[];

    /**
     * Descriptors to register; empty when the generation is not trusted.
     */
    scripts: ContentScriptDescriptor[];
};

/**
 * Registers persistent (`persistAcrossSessions: true`) content scripts for
 * preregistered domains, so build-time-known scriptlet/JS rules run at
 * `document_start`, before the extension itself finishes starting up.
 *
 * Only top-level documents are registered: a subframe's verdict depends on
 * the rules of its parent (the engine passes the parent's frame rule into
 * the subdocument match), and the page cannot read the parent's URL when the
 * domains differ. Frames therefore always keep the dynamic injection path,
 * where the engine decides.
 *
 * Hostnames not in the list keep the standard dynamic injection path.
 *
 * A host that user rules or custom filters can affect keeps the dynamic path
 * as well: those lists exist only at runtime, so the baked artifacts cannot
 * account for them, and a wrong verdict there either runs scriptlets on a
 * page the user excluded or suppresses them where the engine allows them.
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
 * Known limitations are listed in the package README together with the
 * other preregistration constraints; this comment does not repeat them.
 */
export class PreregisteredScriptsService {
    /**
     * Serializes registration mutations — {@link PreregisteredScriptsService.sync}
     * and {@link PreregisteredScriptsService.clear} — so overlapping calls
     * cannot race on the shared content-script namespace.
     */
    private static syncQueue: Promise<unknown> = Promise.resolve();

    /**
     * Fingerprints of the filters checked by the last
     * {@link PreregisteredScriptsService.findStalePageExceptionFilters} call,
     * keyed by filter id. `doSync()` runs on every `configure()`, and
     * `FiltersStorage` already stores a checksum per list, so an unchanged
     * list is compared without reading and parsing its text again.
     */
    private static readonly fingerprintCache = new Map<number, CachedFingerprint>();

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
            // The namespace is known to be empty now.
            appContext.preregisteredScriptRulesAtBootFailed = false;
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.clearRegistrations]: Failed to clear preregistered scripts', e);
            appContext.preregisteredScriptRules = PreregisteredScriptsService.getFallbackCoverage();
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
        // Defaults for a sync that registers nothing: the dynamic path covers
        // every configured host.
        let plan: RegistrationPlan = {
            registeredHostnames: hostnames,
            scripts: [],
        };

        try {
            if (preregistrationEnabled && hostnames.length > 0) {
                plan = await PreregisteredScriptsService.resolveRegistrationPlan(hostnames, scriptsPath);
            }

            const scriptsKey = PreregisteredScriptsService.getScriptsKey(plan.scripts);

            if (scriptsKey === appContext.preregisteredScriptsKey) {
                logger.debug('[tsweb.PreregisteredScriptsService.doSync]: Descriptors unchanged, skipping the sync');
            } else {
                appContext.preregisteredScriptsRegistered = true;
                const { errors } = await ContentScriptManager.sync(
                    PREREGISTERED_SCRIPTS_NAMESPACE,
                    plan.scripts,
                );

                appContext.preregisteredScriptsKey = errors.length === 0
                    ? scriptsKey
                    : undefined;
                appContext.preregisteredScriptsRegistered = errors.length > 0 || plan.scripts.length > 0;
            }
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.doSync]: Sync failed, keeping the previous coverage', e);

            const fallback = PreregisteredScriptsService.getFallbackCoverage();
            appContext.preregisteredScriptRules = fallback;

            return fallback;
        }

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
                : deriveCoverage(plan.scripts);
            appContext.preregisteredScriptRules = coveredRules;

            logger.info(`[tsweb.PreregisteredScriptsService.doSync]: Synced preregistered scripts: ${coveredRules.size}/${plan.registeredHostnames.length} hostnames covered`);

            return coveredRules;
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.doSync]: Failed to read active registrations, reporting empty coverage', e);

            const empty = new Map<string, Set<string>>();
            appContext.preregisteredScriptRules = empty;

            return empty;
        }
    }

    /**
     * Resolves what a sync registers for the shipped generation.
     *
     * The conditions files carry network exceptions baked at build time, and
     * they stay correct only while the filter lists they were built from are
     * still loaded. The build stores a fingerprint of that exception set in
     * the manifest; when it no longer matches the loaded lists, applying the
     * baked exceptions would disable pages the engine filters normally (and
     * miss new ones), so nothing is registered and every host stays on the
     * dynamic path, where the engine decides.
     *
     * A configured host missing from the manifest host set is not registered
     * either: the generation carries no files for it, so registering it would
     * run nothing while the background reports the rules as covered — and
     * `#%#` rules are not idempotent.
     *
     * A host that a user rule or a custom filter can affect is not registered
     * at all: those lists are runtime-only, the baked page gate knows nothing
     * about them, and a wrong verdict there either runs scriptlets on a page
     * the user excluded or suppresses them where the engine allows them. The
     * host keeps the dynamic path, where the engine decides with the full rule
     * set.
     *
     * @param hostnames Configured hostnames, expanded.
     * @param scriptsPath Extension-relative path to preregistered scripts.
     *
     * @returns Registered hostnames and the descriptors to register.
     */
    private static async resolveRegistrationPlan(
        hostnames: readonly string[],
        scriptsPath: string,
    ): Promise<RegistrationPlan> {
        const manifest = await readManifest(scriptsPath);
        const staleFilters = await PreregisteredScriptsService.findStalePageExceptionFilters(manifest);

        if (staleFilters) {
            logger.warn(
                '[tsweb.PreregisteredScriptsService.resolveRegistrationPlan]: Page exceptions changed since the'
                + ' generation, falling back to dynamic injection until the next full generation',
                staleFilters,
            );

            return {
                registeredHostnames: [],
                scripts: [],
            };
        }

        const gateHosts = new Set(manifest.hostnames);
        const registeredHostnames = hostnames.filter((hostname) => gateHosts.has(hostname));
        const skippedHostnames = hostnames.filter((hostname) => !gateHosts.has(hostname));

        if (skippedHostnames.length > 0) {
            logger.warn(
                `[tsweb.PreregisteredScriptsService.resolveRegistrationPlan]: ${skippedHostnames.length}`
                + ' configured hostname(s) are missing from the manifest host set, not registering them',
                skippedHostnames,
            );
        }

        const runtimeAffected = findHostsWithRuntimeExceptions(
            engineApi.getRuntimeExceptionLines(),
            registeredHostnames,
        );
        if (runtimeAffected.size > 0) {
            logger.warn(
                '[tsweb.PreregisteredScriptsService.resolveRegistrationPlan]: User rules or custom filters'
                + ' can change the page verdict for some hostnames, keeping them on the dynamic path',
                [...runtimeAffected],
            );
        }

        const staticHostnames = registeredHostnames.filter((hostname) => !runtimeAffected.has(hostname));

        return {
            registeredHostnames: staticHostnames,
            scripts: await PreregisteredScriptsService.buildDomainScripts(
                [...staticHostnames],
                scriptsPath,
                manifest,
            ),
        };
    }

    /**
     * Lists the filters whose baked page exceptions no longer describe the
     * loaded lists.
     *
     * The build writes a fingerprint per filter into the manifest; the same
     * map is recomputed here for the enabled filters, scoped to the hostnames
     * of the manifest. A filter without a baked entry counts as stale too —
     * its exceptions were not baked at all, so nothing describes them.
     *
     * The fingerprint is cached per filter and reused while the stored list
     * checksum and the covered host set stay the same, so the common case —
     * a sync triggered by a settings change — does not read and parse the
     * lists at all.
     *
     * @param manifest Build-time manifest.
     *
     * @returns Ids of the filters whose baked exceptions must not be applied,
     * or `null` when the baked exceptions describe the loaded lists.
     */
    private static async findStalePageExceptionFilters(
        manifest: PreregisteredScriptsManifest,
    ): Promise<string[] | null> {
        const filterIds = engineApi.getEnabledLocalFiltersIds();
        const hostnamesKey = manifest.hostnames.join('\n');

        const checked = await Promise.all(filterIds.map(async (filterId) => {
            const fingerprint = await PreregisteredScriptsService
                .resolveFilterFingerprint(filterId, hostnamesKey, manifest.hostnames);

            return {
                filterId,
                // `undefined` means the list could not be read: nothing
                // describes its exceptions, so it must not be applied.
                stale: fingerprint === undefined
                    || manifest.pageExceptions[filterId] !== fingerprint,
            };
        }));

        const stale = checked
            .filter(({ stale: isStale }) => isStale)
            .map(({ filterId }) => String(filterId));

        return stale.length > 0 ? stale : null;
    }

    /**
     * Returns the current fingerprint of one filter's page exceptions.
     *
     * The fingerprint is a pure function of the list text, so an unchanged
     * checksum means the cached value still holds: comparing it costs no read
     * of the list and no parsing.
     *
     * @param filterId Filter id.
     * @param hostnamesKey Covered hostnames, joined.
     * @param hostnames Covered hostnames.
     *
     * @returns Fingerprint, or `undefined` when the list could not be read.
     */
    private static async resolveFilterFingerprint(
        filterId: number,
        hostnamesKey: string,
        hostnames: readonly string[],
    ): Promise<string | undefined> {
        const checksum = await FiltersStorage.getChecksum(filterId).catch(() => undefined);
        const cached = PreregisteredScriptsService.fingerprintCache.get(filterId);

        if (checksum !== undefined
            && cached !== undefined
            && cached.checksum === checksum
            && cached.hostnamesKey === hostnamesKey) {
            return cached.fingerprint;
        }

        const content = await FiltersStorage.getRawFilterList(filterId).catch((e) => {
            logger.error(
                `[tsweb.PreregisteredScriptsService.resolveFilterFingerprint]: cannot read filter ${filterId}`,
                e,
            );
            return undefined;
        });

        if (content === undefined) {
            return undefined;
        }

        const lists: PreregisteredFilterList[] = [{ filterId, content }];
        const computed = await computePageExceptionsFingerprint(lists, hostnames);
        const fingerprint = computed[String(filterId)];

        if (checksum !== undefined) {
            PreregisteredScriptsService.fingerprintCache.set(filterId, {
                checksum,
                hostnamesKey,
                fingerprint,
            });
        }

        return fingerprint;
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
     * The page-gate conditions of the enabled filters are registered before
     * the shared bundle: their files append the network exceptions to the
     * list the bundle's gate reads, so a disabled filter's exceptions stop
     * applying.
     *
     * @param hostnames Preregistered hostnames (already normalized).
     * @param scriptsPath Extension-relative path to preregistered scripts.
     * @param manifest Build-time manifest.
     *
     * @returns Content-script descriptors for the covered hostnames. The
     * actual coverage is read separately from the active registrations.
     */
    private static async buildDomainScripts(
        hostnames: readonly string[],
        scriptsPath: string,
        manifest: PreregisteredScriptsManifest,
    ): Promise<ContentScriptDescriptor[]> {
        const manifestHashes = new Set(manifest.hashes);
        const sharedBundlePath = `${scriptsPath}/${SHARED_BUNDLE_FILENAME}`;
        const cleanupPath = `${scriptsPath}/${CLEANUP_FILENAME}`;

        // Page-gate conditions of the enabled filters only: the gate must
        // stop applying an exception as soon as its filter is disabled,
        // exactly like the engine does. The files run before the shared
        // bundle and append to its conditions list; their mutual order is
        // irrelevant, the gate picks the winner by priority. Sorted, so a
        // reordered filter list does not rebuild the descriptors.
        const enabledFilterIds = new Set(engineApi.getEnabledLocalFiltersIds());
        const conditionFiles = [...manifest.conditions]
            .sort((a, b) => a - b)
            .filter((filterId) => enabledFilterIds.has(filterId))
            .map((filterId) => `${scriptsPath}/${getConditionsFilename(filterId)}`);

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
                        ...conditionFiles,
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
                        allFrames: false,
                        matchOriginAsFallback: false,
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
