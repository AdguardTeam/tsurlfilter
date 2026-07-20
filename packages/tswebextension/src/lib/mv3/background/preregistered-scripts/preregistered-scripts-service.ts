/**
 * Copyright (c) 2015-2026 Adguard Software Ltd.
 *
 * @file
 * Preregistered scripts service for MV3.
 *
 * Manages preregistered content-script registrations for domains that have
 * scriptlet or JS injection rules in static filters.
 *
 * At runtime, this service queries the engine per domain to get applicable
 * cosmetic rules, computes their hashes (matching build-time hashes), and
 * registers content scripts with wildcard `matches` and `excludeMatches`
 * for subdomains with different rule sets.
 */

import { CosmeticOption, type CosmeticResult } from '@adguard/tsurlfilter';

import { logger } from '../../../common/utils/logger';
import { type ContentScriptDescriptor, ContentScriptManager } from '../content-script-manager';
import { engineApi } from '../engine-api';

import {
    computeJsRuleHash,
    computeScriptletHash,
    normalizeDomain,
    SHARED_BUNDLE_FILENAME,
} from './hasher';

/**
 * Namespace for content script registration. Must be stable across sessions.
 */
const PREREGISTERED_SCRIPTS_NAMESPACE = 'preregistered';

/**
 * Converts a domain into URL match patterns for `matches`/`excludeMatches`.
 *
 * @param domain Domain string.
 *
 * @returns Two match patterns: `*://domain/*` and `*://*.domain/*`.
 */
const domainToMatchPatterns = (domain: string): string[] => {
    return [`*://${domain}/*`, `*://*.${domain}/*`];
};

/**
 * Finds the longest domain in the list that is a parent of `domain`.
 *
 * @param domain Domain to find parent for.
 * @param allDomains All preregistered domains.
 *
 * @returns Closest parent, or `null` if none.
 */
const findClosestParentDomain = (
    domain: string,
    allDomains: readonly string[],
): string | null => {
    let parent: string | null = null;
    for (const d of allDomains) {
        if (d !== domain && domain.endsWith(`.${d}`)) {
            if (parent === null || d.length > parent.length) {
                parent = d;
            }
        }
    }

    return parent;
};

/**
 * @param a First set.
 * @param b Second set.
 *
 * @returns `true` if both sets contain the same elements.
 */
const setsEqual = <T>(a: Set<T>, b: Set<T>): boolean => {
    if (a.size !== b.size) {
        return false;
    }
    for (const item of a) {
        if (!b.has(item)) {
            return false;
        }
    }

    return true;
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
 * At runtime, this service queries the engine per domain to get applicable
 * cosmetic rules, computes their hashes, and registers content scripts with
 * wildcard `matches` and `excludeMatches` for subdomains with different rule
 * sets. Apex domains cover all subdomains via wildcards; subdomains with
 * exceptions or extra rules get their own registration.
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
            scripts = await PreregisteredScriptsService.buildDomainScripts(
                domains.map(normalizeDomain),
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
     * Builds MAIN-world content-script descriptors with wildcard `matches`
     * and `excludeMatches` for subdomains with different rule sets.
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
        const scripts: ContentScriptDescriptor[] = [];
        const sharedBundlePath = getSharedBundlePath(scriptsPath);

        // Pre-compute hashes for all domains.
        const hashEntries = await Promise.all(
            allDomains.map(async (domain) => {
                const hashes = await PreregisteredScriptsService.getDomainRuleHashes(domain);
                return [domain, hashes] as const;
            }),
        );
        const hashCache = new Map<string, Set<string>>(hashEntries);

        for (const [domain, domainHashes] of hashEntries) {
            if (domainHashes.size === 0) {
                continue;
            }

            // Skip if same hashes as closest parent (parent's wildcard covers it).
            const parent = findClosestParentDomain(domain, allDomains);
            const parentHashes = parent ? hashCache.get(parent) : undefined;
            if (parentHashes && setsEqual(domainHashes, parentHashes)) {
                continue;
            }

            // Find subdomains with different hash sets → excludeMatches.
            const excludeMatches: string[] = [];
            for (const [other, otherHashes] of hashEntries) {
                if (other === domain || !other.endsWith(`.${domain}`)) {
                    continue;
                }
                if (!setsEqual(otherHashes, domainHashes)) {
                    excludeMatches.push(...domainToMatchPatterns(other));
                }
            }
            // Sort for deterministic output — avoids spurious `updateContentScripts`
            // calls caused by non-guaranteed iteration/array order between
            // otherwise-identical `configure()` calls.
            excludeMatches.sort();

            const js = [
                sharedBundlePath,
                ...[...domainHashes].sort().map((hash) => getScriptPath(scriptsPath, hash)),
            ];

            scripts.push({
                id: domain,
                js,
                matches: domainToMatchPatterns(domain),
                excludeMatches: excludeMatches.length > 0 ? excludeMatches : undefined,
                runAt: 'document_start',
                world: 'MAIN',
                allFrames: true,
                persistAcrossSessions: true,
            });
        }

        return scripts;
    }

    /**
     * Queries the engine for cosmetic rules applicable to `domain` and computes
     * their hashes.
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
        const url = `https://${domain}/`;
        const cosmeticResult: CosmeticResult = engineApi.getCosmeticResult(
            url,
            CosmeticOption.CosmeticOptionJS,
        );
        const localRules = cosmeticResult.JS.getRules()
            .filter((rule) => engineApi.isLocalFilter(rule.getFilterListId()));

        const hashes = new Set<string>();

        const hashList = await Promise.all(
            localRules.map(async (rule) => {
                try {
                    if (rule.isScriptlet) {
                        const data = rule.getScriptletData();
                        if (!data) {
                            throw new Error('getScriptletData() returned null');
                        }
                        return await computeScriptletHash(data.params.name, data.params.args);
                    }
                    const content = rule.getContent();
                    return await computeJsRuleHash(content);
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
