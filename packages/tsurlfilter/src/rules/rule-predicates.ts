import {
    type AnyCosmeticRule,
    type AnyRule,
    type NetworkRule as NetworkRuleNode,
    NetworkRuleType,
    RuleCategory,
} from '@adguard/agtree';

/**
 * Type predicate that checks whether an {@link AnyRule} is an {@link AnyCosmeticRule}.
 *
 * @param rule Rule to check.
 *
 * @returns `true` if the rule is an {@link AnyCosmeticRule}.
 */
export const isAnyCosmeticRule = (rule: AnyRule): rule is AnyCosmeticRule => rule.category === RuleCategory.Cosmetic;

/**
 * Type predicate that checks whether an {@link AnyRule} is a {@link NetworkRuleNode}.
 *
 * @param rule Rule to check.
 *
 * @returns `true` if the rule is a {@link NetworkRuleNode}.
 */
export const isNetworkRuleNode = (rule: AnyRule): rule is NetworkRuleNode => {
    return rule.category === RuleCategory.Network && rule.type === NetworkRuleType.NetworkRule;
};
