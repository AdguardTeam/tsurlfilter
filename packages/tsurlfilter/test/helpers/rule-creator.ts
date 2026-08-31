import { NetworkRuleType, RuleCategory, RuleParserPipeline } from '@adguard/agtree';

import { CosmeticRule } from '../../src/rules/cosmetic-rule';
import { NetworkRule } from '../../src/rules/network-rule';
import { type IRule, RULE_INDEX_NONE } from '../../src/rules/rule';
import { RuleFactory } from '../../src/rules/rule-factory';

const parser = new RuleParserPipeline();

/**
 * Helper function to create a network rule from a string.
 *
 * @param rule Rule string.
 * @param filterListId Filter list ID (optional, default is 0).
 * @param ruleIndex Rule index (optional, default is {@link RULE_INDEX_NONE}).
 *
 * @returns Network rule instance.
 *
 * @throws Error if the rule is not a valid network rule.
 */
export const createNetworkRule = (
    rule: string,
    filterListId = 0,
    ruleIndex = RULE_INDEX_NONE,
): NetworkRule => {
    return new NetworkRule(rule.trim(), filterListId, ruleIndex);
};

/**
 * Helper function to create a cosmetic rule from a string.
 *
 * @param rule Rule string.
 * @param filterListId Filter list ID (optional, default is 0).
 * @param ruleIndex Rule index (optional, default is {@link RULE_INDEX_NONE}).
 *
 * @returns Cosmetic rule instance.
 *
 * @throws Error if the rule is not a valid cosmetic rule.
 */
export const createCosmeticRule = (
    rule: string,
    filterListId = 0,
    ruleIndex = RULE_INDEX_NONE,
): CosmeticRule => {
    return new CosmeticRule(rule.trim(), filterListId, ruleIndex);
};

/**
 * Helper function to create a rule from a string.
 *
 * @param rule Rule string.
 * @param filterListId Filter list ID (optional, default is 0).
 * @param ruleIndex Rule index (optional, default is {@link RULE_INDEX_NONE}).
 * @param ignoreNetwork Ignore network rules (optional, default is false).
 * @param ignoreCosmetic Ignore cosmetic rules (optional, default is false).
 * @param ignoreHost Ignore host rules (optional, default is true).
 * @param ignoreHtmlFilteringBodies Ignore HTML filtering rule bodies (optional, default is true).
 *
 * @returns Rule instance.
 *
 * @throws Error if the rule is not a valid rule.
 */
export const createRule = (
    rule: string,
    filterListId = 0,
    ruleIndex = RULE_INDEX_NONE,
    ignoreNetwork = false,
    ignoreCosmetic = false,
    ignoreHost = true,
    ignoreHtmlFilteringBodies = true,
): IRule | null => {
    const trimmedRule = rule.trim();
    const node = parser.parse(trimmedRule, {
        parseHostRules: !ignoreHost,
        parseHtmlFilteringRuleBodies: !ignoreCosmetic && !ignoreHtmlFilteringBodies,
    });

    if (ignoreNetwork && node.category === RuleCategory.Network) {
        return null;
    }

    if (ignoreHost && node.category === RuleCategory.Network && node.type === NetworkRuleType.HostRule) {
        return null;
    }

    if (ignoreCosmetic && node.category === RuleCategory.Cosmetic) {
        return null;
    }

    return RuleFactory.createRule(
        trimmedRule,
        filterListId,
        ruleIndex,
        !ignoreHost,
        !ignoreCosmetic && !ignoreHtmlFilteringBodies,
    );
};
