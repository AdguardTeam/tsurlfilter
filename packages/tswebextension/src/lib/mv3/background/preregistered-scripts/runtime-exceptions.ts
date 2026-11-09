import { NetworkRule } from '@adguard/tsurlfilter';

import { convertRuleLine, isExceptionCandidateLine, splitFilterLines } from './filter-lines';
import { matchesHostScope } from './host-scope';
import { createPreregisteredPageRequest } from './root-request';

/**
 * Keeps the lines that can carry a page exception: an allowlist rule with
 * modifiers. Used to avoid keeping whole runtime lists in memory.
 *
 * @param content Raw filter list text.
 *
 * @returns Candidate lines.
 */
export const collectExceptionLines = (content: string): string[] => {
    return splitFilterLines(content).filter(isExceptionCandidateLine);
};

/**
 * Collects the runtime page exceptions that can change the JS verdict of the
 * given hostnames.
 *
 * A page exception is an allowlist rule with a cosmetic or document-level
 * option: only such rules can win the `cosmeticExceptionRule` or
 * `documentRule` slot, which decides whether JS injection is disabled.
 * Blocking rules and cosmetic rules without these options cannot change that
 * verdict, so they do not count.
 *
 * `$path`/`$url` conditions are ignored: the page URL is unknown here, so a
 * rule that may apply to some URL of the host counts. Over-inclusion is the
 * safe direction — the host then keeps the dynamic path, where the engine
 * decides on the real URL.
 *
 * @param exceptionLines Candidate lines of the runtime-only lists (see
 * {@link collectExceptionLines}).
 * @param hostnames Hostnames to check.
 *
 * @returns Hostnames whose baked conditions cannot be trusted.
 */
export const findHostsWithRuntimeExceptions = (
    exceptionLines: readonly string[],
    hostnames: readonly string[],
): Set<string> => {
    const affected = new Set<string>();
    if (hostnames.length === 0) {
        return affected;
    }

    // Rules that can change the verdict, with their pattern scope.
    const rules: { rule: NetworkRule; pattern: string }[] = [];

    for (const line of exceptionLines) {
        for (const ruleText of convertRuleLine(line)) {
            let rule: NetworkRule;
            try {
                rule = new NetworkRule(ruleText, 0);
            } catch {
                // A rule the engine drops cannot affect its decision.
                continue;
            }

            if (!rule.isAllowlist()) {
                continue;
            }

            if (!rule.hasCosmeticOption() && !rule.isDocumentLevelAllowlistRule()) {
                continue;
            }

            rules.push({ rule, pattern: rule.getPattern() });
        }
    }

    if (rules.length === 0) {
        return affected;
    }

    for (const hostname of hostnames) {
        // The gate only decides document requests, so the modifiers are
        // checked against the same synthetic page request the fingerprint
        // uses.
        const request = createPreregisteredPageRequest(hostname);

        const affectsHost = rules.some(({ rule, pattern }) => matchesHostScope(pattern, hostname)
            && rule.matchModifiers(request));

        if (affectsHost) {
            affected.add(hostname);
        }
    }

    return affected;
};
