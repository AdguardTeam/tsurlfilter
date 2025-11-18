import { type NetworkRule, NetworkRuleOption } from '../network-rule';

/**
 * Rule groups for declarative rules.
 */
export enum RulesGroup {
    /**
     * Regular rules.
     */
    Regular = 0,

    /**
     * `$removeparam` rules.
     */
    RemoveParam = 1,

    /**
     * `$removeheader` rules.
     */
    RemoveHeader = 2,

    /**
     * `$csp` rules.
     */
    Csp = 3,

    /**
     * `$badfilter` rules.
     */
    BadFilter = 4,
}

/**
 * Object that contains grouped rules where key is {@link RulesGroup}
 * and value is an array of {@link NetworkRule}.
 */
export type GroupedRules = Record<RulesGroup, NetworkRule[]>;

/**
 * Utility class to group list of {@link NetworkRule} into {@link GroupedRules}.
 */
export class RulesGrouper {
    /**
     * Returns group for provided `rule`.
     *
     * @param rule {@link NetworkRule} to get group for.
     *
     * @returns Rule group ({@link RulesGroup}).
     */
    private static getRuleGroup(rule: NetworkRule): RulesGroup {
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
     * Groups the list of {@link NetworkRule} into {@link GroupedRules}.
     *
     * @param rules List of {@link NetworkRule} to group.
     *
     * @returns Grouped result of {@link GroupedRules}.
     */
    public static groupRules(rules: NetworkRule[]): GroupedRules {
        const groupedRules: GroupedRules = {
            [RulesGroup.RemoveParam]: [],
            [RulesGroup.RemoveHeader]: [],
            [RulesGroup.BadFilter]: [],
            [RulesGroup.Regular]: [],
            [RulesGroup.Csp]: [],
        };

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            const group = RulesGrouper.getRuleGroup(rule);
            groupedRules[group].push(rule);
        }

        return groupedRules;
    }
}
