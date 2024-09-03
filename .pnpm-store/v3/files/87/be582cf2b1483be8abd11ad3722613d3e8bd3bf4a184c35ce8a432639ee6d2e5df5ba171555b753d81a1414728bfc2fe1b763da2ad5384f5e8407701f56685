import { NetworkRuleOption } from '../network-rule';

import type { IndexedNetworkRuleWithHash } from './network-indexed-rule-with-hash';

export enum RulesGroup {
    Regular = 0,
    RemoveParam = 1,
    RemoveHeader = 2,
    Csp = 3,
    BadFilter = 4,
}

export type GroupedRules = { [key in RulesGroup]: IndexedNetworkRuleWithHash[] };

/**
 * Contains logic on how to divide the rules into certain groups.
 *
 * @see {@link RulesGroup}
 */
export class DeclarativeRulesGrouper {
    /**
     * Returns group of the indexed rule.
     *
     * @param indexedNetworkRuleWithHash Indexed network rule with hash.
     *
     * @returns Group of the indexed rule.
     */
    private static getRuleGroup(indexedNetworkRuleWithHash: IndexedNetworkRuleWithHash): RulesGroup {
        const { rule } = indexedNetworkRuleWithHash;

        if (rule.isOptionEnabled(NetworkRuleOption.RemoveParam)) {
            return RulesGroup.RemoveParam;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.RemoveHeader)) {
            return RulesGroup.RemoveHeader;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Csp)) {
            return RulesGroup.Csp;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Badfilter)) {
            return RulesGroup.BadFilter;
        }

        return RulesGroup.Regular;
    }

    /**
     * Splits the list of indexed rules into an index with groups.
     *
     * @param rules List of indexed rules.
     *
     * @returns Index with grouped, indexed rules.
     */
    public static splitRulesByGroups(rules: IndexedNetworkRuleWithHash[]): GroupedRules {
        const rulesToProcess: GroupedRules = {
            [RulesGroup.RemoveParam]: [],
            [RulesGroup.RemoveHeader]: [],
            [RulesGroup.BadFilter]: [],
            [RulesGroup.Regular]: [],
            [RulesGroup.Csp]: [],
        };

        // Categorizing rule groups
        rules.forEach((indexedNetworkRuleWithHash) => {
            const group = DeclarativeRulesGrouper.getRuleGroup(indexedNetworkRuleWithHash);
            rulesToProcess[group].push(indexedNetworkRuleWithHash);
        });

        return rulesToProcess;
    }
}
