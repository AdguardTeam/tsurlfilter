import { NetworkRule, NetworkRuleOption } from '../network-rule';
import { IndexedRule } from '../rule';

export enum RulesGroup {
    Regular = 0,
    RemoveParam = 1,
    RemoveHeader = 2,
    Csp = 3,
    BadFilter = 4,
}

export type GroupedRules = { [key in RulesGroup]: IndexedRule[] };

/**
 * Contains logic on how to divide the rules into certain groups.
 *
 * @see {@link RulesGroup}
 */
export class DeclarativeRulesGrouper {
    /**
     * Returns group of the indexed rule.
     *
     * @param indexedRule Indexed rule.
     *
     * @returns Group of the indexed rule.
     */
    private static getRuleGroup(indexedRule: IndexedRule): RulesGroup {
        const rule = indexedRule.rule as NetworkRule;

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
    public static splitRulesByGroups(rules: IndexedRule[]): GroupedRules {
        const rulesToProcess: GroupedRules = {
            [RulesGroup.RemoveParam]: [],
            [RulesGroup.RemoveHeader]: [],
            [RulesGroup.BadFilter]: [],
            [RulesGroup.Regular]: [],
            [RulesGroup.Csp]: [],
        };

        // Categorizing rule groups
        rules.forEach((indexedRule) => {
            const group = DeclarativeRulesGrouper.getRuleGroup(indexedRule);
            rulesToProcess[group].push(indexedRule);
        });

        return rulesToProcess;
    }
}
