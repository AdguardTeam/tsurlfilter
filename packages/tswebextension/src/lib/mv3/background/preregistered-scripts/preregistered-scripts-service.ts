import { type CosmeticRule, RequestType } from '@adguard/tsurlfilter';

import { logger } from '../../../common/utils/logger';
import { appContext } from '../app-context';
import { type ContentScriptDescriptor, ContentScriptManager } from '../content-script-manager';
import { CosmeticApi } from '../cosmetic-api';
import { DocumentApi } from '../document-api';
import { engineApi } from '../engine-api';

import {
    CLEANUP_FILENAME,
    computeRuleHashCached,
    getRuleFilename,
    MANIFEST_FILENAME,
    type PreregisteredScriptsManifest,
    SHARED_BUNDLE_FILENAME,
} from './hasher';

/**
 * Namespace for content script registration. Must be stable across sessions.
 */
export const PREREGISTERED_SCRIPTS_NAMESPACE = 'preregistered';

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
 * For each hostname from the build-time `domains.js` the service queries
 * the engine (ignoring `$path`, so path-qualified rules aren't missed),
 * hashes the matching rules and registers
 * `js: [bundle, ...perRuleFiles, cleanup]`. The per-rule file itself
 * enforces any `$path` condition via `location`. `cleanup` runs last,
 * deleting the coordination `window` property before page scripts run.
 *
 * `matchOriginAsFallback: true` additionally covers `about:blank`/srcdoc
 * frames on these hosts, which the dynamic path never reaches — an
 * intentional behavior extension.
 *
 * Hostnames not in the list keep the standard dynamic injection path.
 */
export class PreregisteredScriptsService {
    /**
     * Serializes concurrent {@link PreregisteredScriptsService.sync} calls:
     * engine updates can trigger re-configuration while a previous sync is
     * still in flight, and overlapping syncs would race on the shared
     * content-script namespace.
     */
    private static syncQueue: Promise<unknown> = Promise.resolve();

    /**
     * Initializes the feature for the current configuration: snapshots the
     * persisted registrations once per service-worker lifetime (used to
     * decide dynamic injection for pre-existing tabs), syncs them — or
     * clears all when the feature is not configured, since persisted
     * registrations would otherwise survive forever — and reports the
     * covered rules to {@link CosmeticApi}.
     *
     * @param filteringEnabled Whether preregistration should be active.
     * @param preregisteredScripts Build-time preregistered script
     * configuration, or `undefined` when the feature is not configured.
     * @param preregisteredScripts.domains Preregistered hostnames.
     * @param preregisteredScripts.path Extension-relative path to the
     * preregistered scripts directory.
     */
    public static async init(
        filteringEnabled: boolean,
        preregisteredScripts?: { domains: string[]; path: string },
    ): Promise<void> {
        let coveredRules = new Map<string, Set<string>>();

        if (preregisteredScripts) {
            if (appContext.preregisteredScriptIdsAtBoot === undefined) {
                try {
                    appContext.preregisteredScriptIdsAtBoot = new Set(
                        await ContentScriptManager.listIds(PREREGISTERED_SCRIPTS_NAMESPACE),
                    );
                } catch (e) {
                    logger.error('[tsweb.PreregisteredScriptsService.init]: Failed to snapshot preregistered script ids', e);
                    appContext.preregisteredScriptIdsAtBoot = new Set();
                }
            }

            coveredRules = await PreregisteredScriptsService.sync(
                filteringEnabled,
                preregisteredScripts.domains,
                preregisteredScripts.path,
            );
        } else {
            try {
                await ContentScriptManager.clear(PREREGISTERED_SCRIPTS_NAMESPACE);
            } catch (e) {
                logger.error('[tsweb.PreregisteredScriptsService.init]: Failed to clear preregistered scripts', e);
            }
        }

        CosmeticApi.setPreregisteredScriptRules(coveredRules);
    }

    /**
     * Synchronises preregistered content scripts with the current engine state.
     *
     * Unregisters everything when filtering is disabled or no domains are given.
     * Safe to call repeatedly — diffs against current browser registrations.
     * Concurrent calls are serialized internally.
     *
     * @param filteringEnabled Whether global filtering is enabled.
     * @param domains Preregistered hostnames (from build-time `domains.js`;
     * apex domains and `www.` aliases are separate entries).
     * @param scriptsPath Extension-relative path to the preregistered scripts
     * directory (e.g. `filters/preregistered-scripts`).
     *
     * @returns Promise resolving with, per hostname, the hashes of the rules
     * with an active preregistered registration after the sync. Rules
     * cancelled by runtime `$path` exceptions, missing from the manifest, or
     * whose registration failed are absent — they stay on the dynamic
     * injection path.
     */
    public static async sync(
        filteringEnabled: boolean,
        domains: string[],
        scriptsPath: string,
    ): Promise<Map<string, Set<string>>> {
        const result = PreregisteredScriptsService.syncQueue.then(() => {
            return PreregisteredScriptsService.doSync(
                filteringEnabled,
                domains,
                scriptsPath,
            );
        });

        PreregisteredScriptsService.syncQueue = result.catch(() => undefined);

        return result;
    }

    /**
     * Performs the actual sync; see {@link PreregisteredScriptsService.sync}.
     *
     * @param filteringEnabled Whether global filtering is enabled.
     * @param domains Preregistered hostnames.
     * @param scriptsPath Extension-relative path to the preregistered scripts
     * directory.
     *
     * @returns Promise resolving with the covered rule hashes per hostname.
     */
    private static async doSync(
        filteringEnabled: boolean,
        domains: string[],
        scriptsPath: string,
    ): Promise<Map<string, Set<string>>> {
        try {
            let scripts: ContentScriptDescriptor[] = [];
            let coveredRules = new Map<string, Set<string>>();

            if (filteringEnabled && domains.length > 0) {
                const manifest = await PreregisteredScriptsService.loadManifest(scriptsPath);
                if (!manifest) {
                    return coveredRules;
                }
                const built = await PreregisteredScriptsService.buildDomainScripts(
                    domains,
                    scriptsPath,
                    manifest,
                );
                scripts = built.scripts;
                coveredRules = built.coveredRules;
            }

            const { failedScriptIds } = await ContentScriptManager.syncDetailed(
                PREREGISTERED_SCRIPTS_NAMESPACE,
                scripts,
            );

            if (failedScriptIds.length > 0) {
                logger.error(`[tsweb.PreregisteredScriptsService.doSync]: Failed to register scripts for: ${failedScriptIds.join(', ')}`);
                for (const failedId of failedScriptIds) {
                    coveredRules.delete(failedId);
                }
            }

            logger.info(`[tsweb.PreregisteredScriptsService.doSync]: Synced preregistered scripts: ${coveredRules.size}/${domains.length} domains covered`);

            return coveredRules;
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.doSync]: Sync failed, keeping dynamic injection', e);
            return new Map();
        }
    }

    /**
     * Fetches the build-time manifest shipped next to the artifacts.
     * Required: it lists the rule hashes with matching generated files.
     *
     * @param scriptsPath Extension-relative path to the preregistered scripts
     * directory.
     *
     * @returns Parsed manifest or `null` when unavailable or malformed.
     */
    private static async loadManifest(scriptsPath: string): Promise<PreregisteredScriptsManifest | null> {
        try {
            const url = chrome.runtime.getURL(`${scriptsPath}/${MANIFEST_FILENAME}`);
            const response = await fetch(url);

            if (!response.ok) {
                logger.warn(`[tsweb.PreregisteredScriptsService.loadManifest]: No manifest at ${url} (status ${response.status})`);
                return null;
            }

            const manifest = await response.json();

            if (!manifest || !Array.isArray(manifest.hashes)) {
                logger.warn(`[tsweb.PreregisteredScriptsService.loadManifest]: Malformed manifest at ${url}`);
                return null;
            }

            return manifest;
        } catch (e) {
            logger.warn('[tsweb.PreregisteredScriptsService.loadManifest]: Failed to load manifest', e);
            return null;
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
     * @returns Descriptors plus, per hostname, the hashes of covered rules.
     */
    private static async buildDomainScripts(
        hostnames: string[],
        scriptsPath: string,
        manifest: PreregisteredScriptsManifest,
    ): Promise<{ scripts: ContentScriptDescriptor[]; coveredRules: Map<string, Set<string>> }> {
        const manifestHashes = new Set(manifest.hashes);
        const sharedBundlePath = `${scriptsPath}/${SHARED_BUNDLE_FILENAME}`;
        const cleanupPath = `${scriptsPath}/${CLEANUP_FILENAME}`;

        const scripts: ContentScriptDescriptor[] = [];
        const coveredRules = new Map<string, Set<string>>();

        await Promise.all(
            hostnames.map(async (hostname) => {
                const rules = await PreregisteredScriptsService.getHostnameScriptRules(hostname);
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

                for (const hashResult of hashResults) {
                    if (!hashResult) {
                        continue;
                    }

                    const { rule, hash } = hashResult;

                    if (engineApi.isCosmeticRuleAllowlisted(hostname, rule, true)) {
                        // eslint-disable-next-line max-len
                        logger.warn(`[tsweb.PreregisteredScriptsService.buildDomainScripts]: Rule ${hash} on "${hostname}" is cancelled by a runtime $path exception, keeping dynamic injection`);
                        continue;
                    }

                    if (!manifestHashes.has(hash)) {
                        // eslint-disable-next-line max-len
                        logger.warn(`[tsweb.PreregisteredScriptsService.buildDomainScripts]: No per-hash file for rule ${hash} on "${hostname}", keeping dynamic injection`);
                        continue;
                    }

                    coveredHashes.add(hash);
                }

                if (coveredHashes.size === 0) {
                    return;
                }

                const ruleFiles = [...coveredHashes]
                    .map((hash) => `${scriptsPath}/${getRuleFilename(hash)}`);
                const js = [sharedBundlePath, ...ruleFiles, cleanupPath];

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

                coveredRules.set(hostname, coveredHashes);
            }),
        );

        return { scripts, coveredRules };
    }

    /**
     * Queries the engine for JS/scriptlet rules applicable to `hostname`,
     * ignoring the `$path` modifier so path-qualified rules aren't missed.
     *
     * Only rules from local (built-in) filters are returned. Custom filter
     * and user rules were never scanned at build time, so no matching
     * `{hash}.js` exists for them — they stay on the dynamic
     * (non-preregistered) injection path in {@link CosmeticApi}.
     *
     * @param hostname Hostname string.
     *
     * @returns Applicable local script rules.
     */
    private static async getHostnameScriptRules(hostname: string): Promise<CosmeticRule[]> {
        const url = `https://${hostname}/`;

        const frameRule = DocumentApi.matchFrame(url);

        const cosmeticResult = engineApi.matchCosmetic(
            {
                requestUrl: url,
                frameUrl: url,
                requestType: RequestType.Document,
                frameRule,
            },
            true,
        );

        const allRules = cosmeticResult.getScriptRules();
        return allRules.filter((rule) => engineApi.isLocalFilter(rule.getFilterListId()));
    }
}
