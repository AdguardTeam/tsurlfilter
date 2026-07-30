import { type CosmeticRule, RequestType } from '@adguard/tsurlfilter';

import { logger } from '../../../common/utils/logger';
import { type ContentScriptDescriptor, ContentScriptManager } from '../content-script-manager';
import { DocumentApi } from '../document-api';
import { engineApi } from '../engine-api';

import {
    CLEANUP_BUNDLE_FILENAME,
    computeRuleHash,
    MANIFEST_FILENAME,
    type PreregisteredScriptsManifest,
    SHARED_BUNDLE_FILENAME,
} from './hasher';

/**
 * Namespace for content script registration. Must be stable across sessions.
 */
export const PREREGISTERED_SCRIPTS_NAMESPACE = 'preregistered';

/**
 * Result of {@link PreregisteredScriptsService.sync}.
 */
export interface PreregisteredSyncResult {
    /**
     * Hostnames mapped to the hashes (see {@link computeRuleHash}) of the
     * rules guaranteed to have an active preregistered content script
     * registration after the sync. Rules that are excluded by runtime
     * `$path` exceptions, missing from the manifest, or whose registration
     * failed are absent — they stay on the dynamic injection path. Every
     * other local script rule of a listed hostname is expected to be
     * covered by the registration.
     *
     * Hashes are used as the identity because engine-sourced rules don't
     * carry their text (see `CosmeticRule.getText()`), while the hash is
     * derived from the parsed content and is always computable.
     */
    coveredRules: Map<string, Set<string>>;
}

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
 * @param scriptsPath Base path to preregistered scripts directory.
 *
 * @returns Extension-relative path to the shared scriptlets bundle.
 */
const getSharedBundlePath = (scriptsPath: string): string => {
    return `${scriptsPath}/${SHARED_BUNDLE_FILENAME}`;
};

/**
 * @param scriptsPath Base path to preregistered scripts directory.
 *
 * @returns Extension-relative path to the cleanup script.
 */
const getCleanupPath = (scriptsPath: string): string => {
    return `${scriptsPath}/${CLEANUP_BUNDLE_FILENAME}`;
};

/**
 * @param scriptsPath Base path to preregistered scripts directory.
 * @param hash SHA-256 hash of the scriptlet name + args (or JS rule body).
 *
 * @returns Extension-relative path to the per-hash scriptlet file.
 */
const getScriptPath = (scriptsPath: string, hash: string): string => {
    return `${scriptsPath}/${hash}.js`;
};

/**
 * Registers persistent (`persistAcrossSessions: true`) content scripts for
 * preregistered domains, so build-time-known scriptlet/JS rules run at
 * `document_start`, before the extension itself finishes starting up.
 *
 * Build-time (`tools/resources/preregistered-scripts/`) generates a
 * `{hash}.js` file per rule, a shared `scriptlets-bundle.js`, and
 * `domains.js` listing hostnames with rules (apex and `www.` are separate
 * entries; this service doesn't expand or union them).
 *
 * At runtime, for each listed hostname this service queries the engine
 * (ignoring the `$path` modifier, so path-qualified rules aren't missed),
 * hashes the matching rules, and registers a content script with
 * `js: [sharedBundle, ...perHashFiles, cleanup]`. The per-hash file itself
 * enforces any `$path` condition via `location.pathname`. `cleanup.js` runs
 * last, erasing the shared bundle's coordination `let` before page scripts
 * run.
 *
 * Hostnames not in the list fall back to the standard dynamic injection path.
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
     * @returns Promise resolving with the rules that ended up with an
     * active preregistered registration, per hostname. Callers should keep
     * the dynamic injection for every rule not listed there.
     */
    public static async sync(
        filteringEnabled: boolean,
        domains: string[],
        scriptsPath: string,
    ): Promise<PreregisteredSyncResult> {
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
     * @returns Promise resolving with the sync result.
     */
    private static async doSync(
        filteringEnabled: boolean,
        domains: string[],
        scriptsPath: string,
    ): Promise<PreregisteredSyncResult> {
        let scripts: ContentScriptDescriptor[] = [];
        let coveredRules = new Map<string, Set<string>>();

        if (filteringEnabled && domains.length > 0) {
            const manifest = await PreregisteredScriptsService.loadManifest(scriptsPath);
            const built = await PreregisteredScriptsService.buildDomainScripts(
                domains,
                scriptsPath,
                manifest,
            );
            scripts = built.scripts;
            coveredRules = built.coveredRules;
        }

        try {
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
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.doSync]: Failed to sync preregistered scripts', e);
            coveredRules = new Map();
        }

        logger.info(`[tsweb.PreregisteredScriptsService.doSync]: Synced preregistered scripts: ${coveredRules.size}/${domains.length} domains covered`);

        return { coveredRules };
    }

    /**
     * Fetches the build-time manifest shipped next to the artifacts.
     *
     * A missing or unreadable manifest is not fatal: the service proceeds
     * without the file-existence check (compatibility with consumers that
     * don't ship one).
     *
     * @param scriptsPath Extension-relative path to the preregistered scripts
     * directory.
     *
     * @returns Parsed manifest or `null` when unavailable.
     */
    private static async loadManifest(scriptsPath: string): Promise<PreregisteredScriptsManifest | null> {
        try {
            const url = chrome.runtime.getURL(`${scriptsPath}/${MANIFEST_FILENAME}`);
            const response = await fetch(url);

            if (!response.ok) {
                logger.warn(`[tsweb.PreregisteredScriptsService.loadManifest]: No manifest at ${url} (status ${response.status}), skipping file-existence check`);
                return null;
            }

            const manifest = await response.json();

            if (!manifest || !Array.isArray(manifest.hashes)) {
                logger.warn(`[tsweb.PreregisteredScriptsService.loadManifest]: Malformed manifest at ${url}, skipping file-existence check`);
                return null;
            }

            return manifest;
        } catch (e) {
            logger.warn('[tsweb.PreregisteredScriptsService.loadManifest]: Failed to load manifest, skipping file-existence check', e);
            return null;
        }
    }

    /**
     * Builds MAIN-world content-script descriptors for the given hostnames,
     * each treated independently (no apex/`www.` expansion or union).
     *
     * Individual rules degrade to dynamic injection when they are cancelled
     * by a runtime `$path` exception, or — when a build-time manifest is
     * available — their per-hash file is not in the bundle (a registration
     * would 404 at best). A hostname with no surviving rules is not
     * registered at all.
     *
     * @param hostnames Preregistered hostnames (already normalized).
     * @param scriptsPath Extension-relative path to preregistered scripts.
     * @param manifest Build-time manifest or `null` when unavailable.
     *
     * @returns Descriptors plus, per hostname, the hashes of covered rules.
     */
    private static async buildDomainScripts(
        hostnames: string[],
        scriptsPath: string,
        manifest: PreregisteredScriptsManifest | null,
    ): Promise<{ scripts: ContentScriptDescriptor[]; coveredRules: Map<string, Set<string>> }> {
        const sharedBundlePath = getSharedBundlePath(scriptsPath);
        const manifestHashes = manifest ? new Set(manifest.hashes) : null;

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
                            return { rule, hash: await computeRuleHash(rule) };
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

                    if (manifestHashes && !manifestHashes.has(hash)) {
                        // eslint-disable-next-line max-len
                        logger.warn(`[tsweb.PreregisteredScriptsService.buildDomainScripts]: No per-hash file for rule ${hash} on "${hostname}", keeping dynamic injection`);
                        continue;
                    }

                    coveredHashes.add(hash);
                }

                if (coveredHashes.size === 0) {
                    return;
                }

                const js = [
                    sharedBundlePath,
                    ...[...coveredHashes].map((hash) => getScriptPath(scriptsPath, hash)),
                    getCleanupPath(scriptsPath),
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
