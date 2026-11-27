import { NetworkRule, type Request } from '@adguard/tsurlfilter';

import { convertRuleLine, isExceptionCandidateLine, splitFilterLines } from '../filter-lines';

import { parsePattern } from './pattern';
import { type Candidate, type ExceptionSource, PatternReach } from './types';

/**
 * Parses the candidate rules out of the sources: allowlist rules that can
 * win one of the two slots the JS bit depends on.
 *
 * @param sources Candidate lines of the enabled filters.
 *
 * @returns Parsed candidate rules.
 */
export const collectCandidates = (sources: readonly ExceptionSource[]): Candidate[] => {
    const candidates: Candidate[] = [];

    for (const source of sources) {
        for (const line of source.lines) {
            for (const ruleText of convertRuleLine(line)) {
                let rule: NetworkRule;
                try {
                    rule = new NetworkRule(ruleText, source.filterId);
                } catch {
                    // The engine drops rules it cannot parse as well.
                    continue;
                }

                if (!rule.isAllowlist()) {
                    continue;
                }

                // The engine drops such a rule for this filter, so it cannot
                // decide a page either.
                if (source.unsafeIgnored && rule.isUnsafe()) {
                    continue;
                }

                if (!rule.hasCosmeticOption() && !rule.isDocumentLevelAllowlistRule()) {
                    continue;
                }

                const pattern = rule.getPattern();
                const parsed = parsePattern(pattern);

                // A pattern no http(s) document can match can neither exclude
                // a page nor widen the fallback, so it is not a candidate.
                if (parsed.kind === PatternReach.Unreachable) {
                    continue;
                }

                candidates.push({
                    rule,
                    writtenText: line,
                    patternHost: parsed.kind === PatternReach.Host ? parsed.host : undefined,
                    inDomainsTable: rule.isInDomainsTable(),
                });
            }
        }
    }

    return candidates;
};

/**
 * Checks whether the rule carries a `$domain` list at all.
 *
 * @param rule Candidate rule.
 *
 * @returns True when the rule has permitted or restricted domains.
 */
const hasDomainList = (rule: NetworkRule): boolean => (
    rule.getPermittedDomains() !== null || rule.getRestrictedDomains() !== null
);

/**
 * Checks whether the rule's `$domain` list applies to the page of the host.
 *
 * The question is answered by the engine's own reader, so a regexp domain, a
 * wildcard domain and a restricted-only list are read exactly like the runtime
 * reads them.
 *
 * @param rule Candidate rule.
 * @param pageRequest Request of the host's page, used as its own source.
 *
 * @returns True when the rule carries a `$domain` list and that list allows
 * this host.
 */
export const isDomainScopedToHost = (rule: NetworkRule, pageRequest: Request): boolean => (
    hasDomainList(rule) && rule.matchDomainModifier(pageRequest)
);

/**
 * Keeps the allowlist lines of a filter list, so a later scan does not have
 * to re-split the whole list.
 *
 * @param content Raw filter list text.
 *
 * @returns Candidate lines.
 */
export const collectExceptionLines = (content: string): string[] => {
    return splitFilterLines(content).filter(isExceptionCandidateLine);
};
