import { MatchingResult, type NetworkRule } from '@adguard/tsurlfilter';

import { type HostRequests } from './requests';
import { type Candidate, type ScopedCandidate } from './types';

/**
 * Resolves the rules that survive `$badfilter`.
 *
 * The engine resolves a `$badfilter` within the rule set that matched the
 * request and compares the written text, so the scan passes the original line.
 * The call does not mutate its argument.
 *
 * @param inScope Candidates that reach the host.
 * @param requests Requests of the host.
 * @param candidatesByRule Candidates keyed by rule, for the written text.
 *
 * @returns Rules that stay active.
 */
export const resolveActiveRules = (
    inScope: readonly ScopedCandidate[],
    requests: HostRequests,
    candidatesByRule: ReadonlyMap<NetworkRule, Candidate>,
): Set<NetworkRule> => {
    const cosmeticRules: NetworkRule[] = [];
    const documentRules: NetworkRule[] = [];

    for (const { candidate } of inScope) {
        const { rule } = candidate;

        if (rule.hasCosmeticOption() && rule.matchModifiers(requests.cosmetic)) {
            cosmeticRules.push(rule);
        }

        // The domains table returns nothing for a request without a source, so
        // its rules can never win the document slot of a main frame. The flag
        // is host-independent and was answered on collection.
        if (rule.isDocumentLevelAllowlistRule()
            && !candidate.inDomainsTable
            && rule.matchModifiers(requests.document)) {
            documentRules.push(rule);
        }
    }

    const resolveWrittenText = (rule: NetworkRule): string | null => candidatesByRule.get(rule)?.writtenText ?? null;

    return new Set<NetworkRule>([
        ...MatchingResult.removeBadfilterRules(cosmeticRules, resolveWrittenText),
        ...MatchingResult.removeBadfilterRules(documentRules, resolveWrittenText),
    ]);
};
