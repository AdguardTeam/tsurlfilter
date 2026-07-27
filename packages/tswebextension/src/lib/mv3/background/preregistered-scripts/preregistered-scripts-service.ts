import { logger } from '../../../common/utils/logger';
import { type ContentScriptDescriptor, ContentScriptManager } from '../content-script-manager';
import { engineApi } from '../engine-api';

import {
    CLEANUP_BUNDLE_FILENAME,
    computeRuleHash,
    normalizeDomain,
    SHARED_BUNDLE_FILENAME,
} from './hasher';

/**
 * Namespace for content script registration. Must be stable across sessions.
 */
const PREREGISTERED_SCRIPTS_NAMESPACE = 'preregistered';

/**
 * Converts a domain into URL match patterns for `matches`.
 *
 * Only the exact apex domain and its `www.` alias are matched — subdomains
 * are intentionally out of scope (see class-level doc).
 *
 * @param domain Domain string.
 *
 * @returns Two match patterns: `*://domain/*` and `*://www.domain/*`.
 */
const domainToMatchPatterns = (domain: string): string[] => {
    return [`*://${domain}/*`, `*://www.${domain}/*`];
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
 * domains that have rules.
 *
 * At runtime, this service queries the engine per domain (ignoring the
 * `$path` modifier, so path-qualified rules aren't missed) to get applicable
 * JS/scriptlet rules, computes their hashes, and registers a content script
 * for the exact apex domain and its `www.` alias. Subdomains are
 * intentionally NOT covered by wildcard matches — only the fixed set of
 * preregistered domains (and their `www.` alias) is registered; any other
 * subdomain falls back to the standard dynamic injection path.
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
     * @param domains List of preregistered domain strings.
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
            const normalizedDomains = [...new Set(domains.map(normalizeDomain))];
            scripts = await PreregisteredScriptsService.buildDomainScripts(
                normalizedDomains,
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
     * Builds MAIN-world content-script descriptors for the exact preregistered
     * domains (and their `www.` alias). Subdomains are not covered.
     *
     * @param allDomains All preregistered domains (already normalized).
     * @param scriptsPath Extension-relative path to preregistered scripts.
     *
     * @returns Array of content-script descriptors.
     */
    private static async buildDomainScripts(
        allDomains: string[],
        scriptsPath: string,
    ): Promise<ContentScriptDescriptor[]> {
        const sharedBundlePath = getSharedBundlePath(scriptsPath);

        const scripts = await Promise.all(
            allDomains.map(async (domain): Promise<ContentScriptDescriptor | null> => {
                const domainHashes = await PreregisteredScriptsService.getDomainRuleHashes(domain);
                if (domainHashes.size === 0) {
                    return null;
                }

                const js = [
                    sharedBundlePath,
                    ...[...domainHashes].sort().map((hash) => getScriptPath(scriptsPath, hash)),
                    getCleanupPath(scriptsPath),
                ];

                return {
                    id: domain,
                    js,
                    matches: domainToMatchPatterns(domain),
                    runAt: 'document_start',
                    world: 'MAIN',
                    allFrames: true,
                    matchOriginAsFallback: true,
                    persistAcrossSessions: true,
                };
            }),
        );

        return scripts.filter((script): script is ContentScriptDescriptor => script !== null);
    }

    /**
     * Queries the engine for JS/scriptlet rules applicable to `domain`
     * **and** its `www.` alias (union of both, so a rule targeting only
     * `www.domain` isn't missed), ignoring the `$path` modifier (so
     * path-qualified rules aren't missed either), and computes their hashes.
     *
     * Only rules from **local** (built-in, pre-bundled) filters are hashed.
     * Rules from custom filters or user rules are intentionally excluded:
     * they were never scanned by the build-time collector, so no matching
     * `{hash}.js` file exists for them, and including them here would produce
     * a hash with no corresponding file, breaking content-script registration
     * for the whole domain. Such rules continue to be handled by the existing
     * dynamic (non-preregistered) injection path in {@link CosmeticApi}.
     *
     * @param domain Domain string.
     *
     * @returns Set of rule hash strings.
     */
    private static async getDomainRuleHashes(domain: string): Promise<Set<string>> {
        const urls = [`https://${domain}/`, `https://www.${domain}/`];
        const allRules = urls.flatMap((url) => engineApi.getJsRulesIgnoringPath(url));
        const localRules = allRules
            .filter((rule) => engineApi.isLocalFilter(rule.getFilterListId()));

        const hashes = new Set<string>();

        const hashList = await Promise.all(
            localRules.map(async (rule) => {
                try {
                    return await computeRuleHash(rule);
                } catch (e) {
                    logger.warn(
                        `[tsweb.PreregisteredScriptsService.getDomainRuleHashes]: Failed to hash rule: ${domain}`,
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
