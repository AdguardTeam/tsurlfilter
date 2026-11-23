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
 * Order the lookup tables are tried in.
 *
 * This is the only place the order is written: `NetworkEngine` adds rules and
 * walks the tables in it, and `getRuleTable()` reports the same order. Adding a
 * table to the engine without adding it here, or reordering one side only,
 * would change where a rule lands and which rule wins a priority tie.
 */
export const RULE_TABLE_ORDER: readonly RuleTable[] = [
    RuleTable.Hostname,
    RuleTable.Shortcut,
    RuleTable.Domains,
    RuleTable.Seqscan,
];

/**
 * Per-table check `getRuleTable()` walks in {@link RULE_TABLE_ORDER}.
 *
 * The predicates are the ones the tables themselves use in `addRule()`, so the
 * routing and the reported table cannot disagree. `Seqscan` takes whatever the
 * other tables declined.
 */
const RULE_TABLE_ACCEPTS: Record<RuleTable, (rule: NetworkRule, pattern: string) => boolean> = {
    [RuleTable.Hostname]: (_rule, pattern) => HostnameLookupTable.accepts(pattern),
    [RuleTable.Shortcut]: (_rule, pattern) => TrieLookupTable.accepts(pattern),
    [RuleTable.Domains]: (rule) => DomainsLookupTable.accepts(getRuleDomains(rule)),
    [RuleTable.Seqscan]: () => true,
};

/**
 * Resolves the lookup table `NetworkEngine.addRule()` puts the rule into.
 *
 * The tables are tried in {@link RULE_TABLE_ORDER}, the same order the engine
 * uses and the first one that accepts the rule keeps it. The order and the
 * predicates live with the tables, so the engine and this function cannot
 * drift apart. Kept internal: the only caller outside the engine is
 * `NetworkRule.isInDomainsTable()`, which exposes the question, not the
 * routing.
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
    for (const table of RULE_TABLE_ORDER) {
        if (RULE_TABLE_ACCEPTS[table](rule, pattern)) {
            return table;
        }
    }

    return RuleTable.Seqscan;
};
