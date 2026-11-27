import { type NetworkRule, NetworkRuleOption } from '@adguard/tsurlfilter';

import { resolveActiveRules } from './active-rules';
import { decide, type Disabling, type Keeping } from './decision';
import { toExcludePattern } from './exclude-pattern';
import { createHostRequests } from './requests';
import { resolveScope } from './scope';
import { type Candidate, Scope, type ScopedCandidate } from './types';

/**
 * Keeps the candidates whose pattern can reach the host. Reach is a lexical
 * question, so it is answered before the modifier passes: a pattern that names
 * another site can never decide this host, and a pattern with no host part can
 * match any URL.
 *
 * @param candidates All parsed candidates.
 * @param hostname Hostname of the registration.
 *
 * @returns Candidates that reach the host, with their scope.
 */
export const selectInScope = (
    candidates: readonly Candidate[],
    hostname: string,
): ScopedCandidate[] => (
    candidates
        .map((candidate) => ({
            candidate,
            scope: candidate.patternHost
                ? resolveScope(candidate.patternHost, hostname)
                : Scope.Hostless,
        }))
        .filter(({ scope }) => scope !== Scope.Other)
);

/**
 * Collects the URL exclusions of one hostname.
 *
 * The scan mirrors the engine's own decision instead of re-implementing rule
 * syntax: rules are parsed by `NetworkRule`, the eligibility conditions copy
 * `NetworkRule.match()`, `$badfilter` is resolved with
 * `MatchingResult.removeBadfilterRules()` on the same rule set the engine
 * matches with, and the reach of a pattern is the engine's own comparison.
 *
 * Two requests are evaluated per host, exactly like the runtime does for a
 * main frame: the cosmetic slot uses the page as both the request and the
 * source, while the document slot has no source, so `$domain` matching differs
 * between the slots.
 *
 * @param candidatesByRule Candidate rules of all enabled filters, keyed by the
 * rule they were parsed into.
 * @param hostname Hostname to build exclusions for.
 *
 * @returns Exclusion patterns of the host, or the reason it stays dynamic.
 * Report of the host-less exceptions is not included for a host that turned
 * dynamic: what such a host collected depends on the iteration order, and the
 * caller logs the union across hosts.
 */
export const buildHostExclusions = (
    candidatesByRule: ReadonlyMap<NetworkRule, Candidate>,
    hostname: string,
): {
    patterns: string[];
    dynamic?: string;
    unanchored?: string[];
} => {
    const requests = createHostRequests(hostname);
    const inScope = selectInScope([...candidatesByRule.values()], hostname);
    const activeRules = resolveActiveRules(inScope, requests, candidatesByRule);

    const disabling: Disabling[] = [];
    const keeping: Keeping[] = [];
    const unanchored: string[] = [];

    for (const { candidate, scope } of inScope) {
        const { rule, writtenText } = candidate;

        if (!activeRules.has(rule)) {
            continue;
        }

        const decision = decide(candidate, scope, requests);

        switch (decision.kind) {
            case 'dynamic':
                return { patterns: [], dynamic: decision.reason };
            case 'keeping':
                keeping.push({ rule, writtenText });
                break;
            case 'unanchored':
                unanchored.push(writtenText);
                break;
            case 'disabling':
                disabling.push({ rule, patternHost: decision.patternHost, writtenText });
                break;
            // The union is closed, so every decision kind is handled here.
            // no default
        }
    }

    if (disabling.length === 0) {
        return { patterns: [], unanchored };
    }

    // An exception that keeps JS injection on and outranks a disabling one
    // would win on the same page: the registration cannot tell which page a
    // priority decides, so the host stays dynamic.
    const lowestDisablingPriority = Math.min(...disabling.map(({ rule }) => rule.getPriorityWeight()));
    const shield = keeping.find(({ rule }) => rule.getPriorityWeight() >= lowestDisablingPriority);
    if (shield) {
        return {
            patterns: [],
            dynamic: `${shield.writtenText}: an exception ranked at least as high keeps JS injection on`,
        };
    }

    const patterns = new Set<string>();

    for (const { rule, patternHost, writtenText } of disabling) {
        const pattern = toExcludePattern(patternHost, hostname, rule.isOptionEnabled(NetworkRuleOption.MatchCase));

        if (!pattern) {
            return {
                patterns: [],
                dynamic: `${writtenText}: the exception cannot be expressed as an excludeMatches pattern`,
            };
        }

        patterns.add(pattern);
    }

    return { patterns: [...patterns].sort(), unanchored };
};
