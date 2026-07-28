import { logger } from '../../../common/utils/logger';
import { type ContentScriptDescriptor, ContentScriptManager } from '../content-script-manager';
import { engineApi } from '../engine-api';

import { CLEANUP_BUNDLE_FILENAME, computeRuleHash, SHARED_BUNDLE_FILENAME } from './hasher';

/**
 * Namespace for content script registration. Must be stable across sessions.
 */
const PREREGISTERED_SCRIPTS_NAMESPACE = 'preregistered';

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
 * Manages preregistered content-script registrations for preregistered domains.
 *
 * Scripts use `persistAcrossSessions: true` so they survive browser restarts.
 *
 * Build-time (`tools/resources/preregistered-scripts/`) generates per-rule
 * `{hash}.js` files, a shared `scriptlets-bundle.js`, and `domains.js` listing
 * hostnames that have rules — each hostname (apex domain and/or its `www.`
 * alias) is a separate, independent entry; this service does not expand or
 * union apex/`www.` variants itself.
 *
 * At runtime, this service queries the engine per hostname (ignoring the
 * `$path` modifier, so path-qualified rules aren't missed) to get applicable
 * JS/scriptlet rules, computes their hashes, and registers a content script
 * for that exact hostname. Any hostname not in the list (including
 * subdomains other than a listed `www.` alias) falls back to the standard
 * dynamic injection path.
 *
 * Rules with a `$path` modifier are still included in a domain's registration
 * (over-collection is intentional — the file is loaded on every path), but
 * the actual path condition is enforced at runtime inside the generated
 * per-hash file itself, which checks `location.pathname` before executing.
 *
 * Each registration's `js` array is `[sharedBundle, ...perHashFiles, cleanup]`.
 * The cleanup script always runs last, deleting the shared bundle's
 * `window`-scoped coordination property before the page's own scripts get a
 * chance to run, so page code never observes it.
 */
export class PreregisteredScriptsService {
    /**
     * Synchronises preregistered content scripts with the current engine state.
     *
     * All scripts are unregistered when filtering is disabled or no domains are
     * provided. The sync call diffs against current browser registrations, so
     * repeated calls with same state are safe.
     *
     * @param filteringEnabled Whether global filtering is enabled.
     * @param domains List of preregistered hostnames (build-time `domains.js`
     * output — already normalized and deduped; apex domains and `www.`
     * aliases are separate entries).
     * @param scriptsPath Extension-relative path to the preregistered scripts
     * directory (e.g. `filters/preregistered-scripts`).
     *
     * @returns `true` if all scripts were registered/updated/removed
     * successfully, `false` if any operation failed. Callers should only
     * treat these domains as "covered by preregistered scripts" (e.g. by
     * disabling the dynamic injection fallback) when this resolves to `true`.
     */
    public static async sync(
        filteringEnabled: boolean,
        domains: string[],
        scriptsPath: string,
    ): Promise<boolean> {
        let scripts: ContentScriptDescriptor[] = [];

        if (filteringEnabled && domains.length > 0) {
            scripts = await PreregisteredScriptsService.buildDomainScripts(
                domains,
                scriptsPath,
            );
        }

        try {
            const errors = await ContentScriptManager.sync(PREREGISTERED_SCRIPTS_NAMESPACE, scripts);
            if (errors.length > 0) {
                logger.error(`[tsweb.PreregisteredScriptsService.sync]: ${errors.length} operation(s) failed while syncing preregistered scripts`);
                return false;
            }
            return true;
        } catch (e) {
            logger.error('[tsweb.PreregisteredScriptsService.sync]: Failed to sync preregistered scripts', e);
            return false;
        }
    }

    /**
     * Builds MAIN-world content-script descriptors for the given hostnames,
     * each treated independently (no apex/`www.` expansion or union).
     *
     * @param hostnames Preregistered hostnames (already normalized).
     * @param scriptsPath Extension-relative path to preregistered scripts.
     *
     * @returns Array of content-script descriptors.
     */
    private static async buildDomainScripts(
        hostnames: string[],
        scriptsPath: string,
    ): Promise<ContentScriptDescriptor[]> {
        const sharedBundlePath = getSharedBundlePath(scriptsPath);
        const scripts: ContentScriptDescriptor[] = [];

        // Registration order doesn't matter — ContentScriptManager.sync() diffs by `id`.
        await Promise.all(
            hostnames.map(async (hostname) => {
                const ruleHashes = await PreregisteredScriptsService.getHostnameRuleHashes(hostname);
                if (ruleHashes.size === 0) {
                    return;
                }

                const js = [
                    sharedBundlePath,
                    ...[...ruleHashes].sort().map((hash) => getScriptPath(scriptsPath, hash)),
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
            }),
        );

        return scripts;
    }

    /**
     * Queries the engine for JS/scriptlet rules applicable to `hostname`,
     * ignoring the `$path` modifier (so path-qualified rules aren't missed),
     * and computes their hashes.
     *
     * Only rules from **local** (built-in, pre-bundled) filters are hashed.
     * Rules from custom filters or user rules are intentionally excluded:
     * they were never scanned by the build-time collector, so no matching
     * `{hash}.js` file exists for them, and including them here would produce
     * a hash with no corresponding file, breaking content-script registration
     * for the whole hostname. Such rules continue to be handled by the existing
     * dynamic (non-preregistered) injection path in {@link CosmeticApi}.
     *
     * @param hostname Hostname string.
     *
     * @returns Set of rule hash strings.
     */
    private static async getHostnameRuleHashes(hostname: string): Promise<Set<string>> {
        const allRules = engineApi.getJsRulesIgnoringPath(`https://${hostname}/`);
        const localRules = allRules
            .filter((rule) => engineApi.isLocalFilter(rule.getFilterListId()));

        const hashes = new Set<string>();

        const hashList = await Promise.all(
            localRules.map(async (rule) => {
                try {
                    return await computeRuleHash(rule);
                } catch (e) {
                    logger.warn(
                        `[tsweb.PreregisteredScriptsService.getHostnameRuleHashes]: Failed to hash rule: ${hostname}`,
                        e,
                    );
                    return null;
                }
            }),
        );

        for (const hash of hashList) {
            if (hash !== null) {
                hashes.add(hash);
            }
        }

        return hashes;
    }
}
