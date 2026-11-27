/**
 * @file URL exclusions of the preregistered registrations: the pages of a host
 * whose filter exceptions disable JS injection, expressed as `excludeMatches`.
 *
 * Reading order — every module only imports the ones above it:
 *
 * 1. `types`             — contracts: sources, candidates, scope, decision.
 * 2. `pattern`           — a rule pattern → scheme, anchor, host, path.
 * 3. `scope`             — does a parsed pattern reach this hostname?
 * 4. `exclude-pattern`   — a reach → an `excludeMatches` entry, or "cannot
 *                          express".
 * 5. `candidates`        — filter lines → parsed candidates, `$domain` checks.
 * 6. `requests`          — the two requests one hostname is evaluated with.
 * 7. `active-rules`      — which candidates survive `$badfilter`.
 * 8. `decision`          — what one candidate means for the host.
 * 9. `host-exclusions`   — the per-host verdict assembled from all of the above.
 *
 * This file exposes the public entry points and nothing else.
 */

import { collectCandidates } from './candidates';
import { buildHostExclusions } from './host-exclusions';
import { type ExceptionSource, type JsExclusions } from './types';

export { collectExceptionLines } from './candidates';
export {
    type ExceptionSource,
    type JsExclusions,
} from './types';

/**
 * Resolves the URL exclusions of the registrations for the given hostnames.
 *
 * @param sources Candidate lines of the enabled filters.
 * @param hostnames Hostnames to build exclusions for.
 *
 * @returns Exclusions per hostname and the hosts that must stay dynamic.
 */
export const resolveHostExclusions = (
    sources: readonly ExceptionSource[],
    hostnames: readonly string[],
): JsExclusions => {
    const exclusions = new Map<string, string[]>();
    const dynamicHosts = new Map<string, string>();
    const unanchoredExceptions = new Set<string>();

    if (hostnames.length === 0) {
        return {
            exclusions,
            dynamicHosts,
            unanchoredExceptions: [],
        };
    }

    const candidates = collectCandidates(sources);
    const candidatesByRule = new Map(candidates.map((candidate) => [candidate.rule, candidate]));

    for (const hostname of hostnames) {
        const { patterns, dynamic, unanchored } = buildHostExclusions(candidatesByRule, hostname);

        unanchored?.forEach((text) => unanchoredExceptions.add(text));

        if (dynamic) {
            dynamicHosts.set(hostname, dynamic);
            continue;
        }

        if (patterns.length > 0) {
            exclusions.set(hostname, patterns);
        }
    }

    return {
        exclusions,
        dynamicHosts,
        unanchoredExceptions: [...unanchoredExceptions].sort(),
    };
};
