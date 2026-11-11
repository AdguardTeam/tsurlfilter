import { type NetworkRule } from '../../rules/network-rule';

import { DomainsLookupTable } from './domains-lookup-table';
import { HostnameLookupTable } from './hostname-lookup-table';
import { TrieLookupTable } from './trie-lookup-table';

/**
 * Lookup table a network rule is stored in.
 *
 * The order is the order `NetworkEngine.matchAll()` walks the tables in, and
 * it decides a tie between two matched rules of equal priority.
 */
export enum RuleTable {
    /**
     * `||host^` and `||host/path` rules, keyed by hostname hash.
     */
    Hostname,

    /**
     * Rules with an indexable shortcut.
     */
    Shortcut,

    /**
     * Rules with a positive `$domain` and no wildcard or regex domain.
     */
    Domains,

    /**
     * Everything else, matched by a full rule check.
     */
    Seqscan,
}

/**
 * Domains as the engine reads them from the rule text: restricted ones keep
 * the `~` prefix. `DomainsLookupTable.accepts()` relies on it.
 *
 * @param rule Network rule.
 *
 * @returns Rule domains.
 */
const getRuleDomains = (rule: NetworkRule): string[] => [
    ...(rule.getPermittedDomains() ?? []),
    ...(rule.getRestrictedDomains() ?? []).map((domain) => `~${domain}`),
];

/**
 * Resolves the lookup table `NetworkEngine.addRule()` puts the rule into.
 *
 * The tables are tried in `RuleTable` order and the first one that accepts the
 * rule keeps it. The predicates live with the tables, so the engine and this
 * function cannot drift apart. Kept internal: the only caller outside the
 * engine is `NetworkRule.isInDomainsTable()`, which exposes the question, not
 * the routing.
 *
 * @param rule Network rule.
 *
 * @returns Lookup table the engine keeps the rule in.
 */
export const getRuleTable = (rule: NetworkRule): RuleTable => {
    const pattern = rule.getPattern();

    // The engine reads the same pattern from the rule text, so the two sources
    // must agree; a wildcard-only difference would move the rule between
    // tables and change a tie.
    if (HostnameLookupTable.accepts(pattern)) {
        return RuleTable.Hostname;
    }

    if (TrieLookupTable.accepts(pattern)) {
        return RuleTable.Shortcut;
    }

    if (DomainsLookupTable.accepts(getRuleDomains(rule))) {
        return RuleTable.Domains;
    }

    return RuleTable.Seqscan;
};
