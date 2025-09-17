import {
    NetworkRuleType,
    RuleCategory,
    type AnyCosmeticRule,
    type AnyRule,
    type NetworkRule as NetworkRuleNode,
} from '@adguard/agtree';
import {
    defaultParserOptions,
    CosmeticRuleParser,
    NetworkRuleParser,
    RuleParser,
} from '@adguard/agtree/parser';
import {
    CosmeticRule,
    type IRule,
    NetworkRule,
    RULE_INDEX_NONE,
    RuleFactory,
} from '@adguard/tsurlfilter';
import { isString } from 'lodash-es';

/**
 * Helper function to create a network rule from a string or a parsed node.
 * This is needed because the default API for creating a network rule only accepts nodes,
 * but it's more convenient to create rules from strings.
 *
 * @param rule Rule string or parsed node.
 * @param filterListId Filter list ID (optional, default is 0).
 * @param ruleIndex Rule index (optional, default is {@link RULE_INDEX_NONE}).
 *
 * @returns Network rule instance.
 *
 * @throws Error if the rule is not a valid network rule.
 */
export const createNetworkRule = (
    rule: string | NetworkRuleNode,
    filterListId = 0,
    ruleIndex = RULE_INDEX_NONE,
): NetworkRule => {
    let node: NetworkRuleNode;

    if (isString(rule)) {
        node = NetworkRuleParser.parse(rule.trim());
    } else {
        node = rule;
    }

    return new NetworkRule(node, filterListId, ruleIndex);
};

/**
 * Helper function to create a cosmetic rule from a string or a parsed node.
 * This is needed because the default API for creating a cosmetic rule only accepts nodes,
 * but it's more convenient to create rules from strings.
 *
 * @param rule Rule string or parsed node.
 * @param filterListId Filter list ID (optional, default is 0).
 * @param ruleIndex Rule index (optional, default is {@link RULE_INDEX_NONE}).
 *
 * @returns Cosmetic rule instance.
 *
 * @throws Error if the rule is not a valid cosmetic rule.
 */
export const createCosmeticRule = (
    rule: string | AnyCosmeticRule,
    filterListId = 0,
    ruleIndex = RULE_INDEX_NONE,
): CosmeticRule => {
    let node: AnyCosmeticRule;

    if (isString(rule)) {
        const parsedNode = CosmeticRuleParser.parse(rule.trim(), {
            parseAbpSpecificRules: false,
            parseUboSpecificRules: false,
        });

        if (!parsedNode) {
            throw new Error('Not a cosmetic rule');
        }

        node = parsedNode;
    } else {
        node = rule;
    }

    return new CosmeticRule(node, filterListId, ruleIndex);
};

/**
 * Helper function to create a rule from a string or a parsed node.
 * This is needed because the default API for creating a rule only accepts nodes,
 * but it's more convenient to create rules from strings.
 *
 * @param rule Rule string or parsed node.
 * @param filterListId Filter list ID (optional, default is 0).
 * @param ruleIndex Rule index (optional, default is {@link RULE_INDEX_NONE}).
 * @param ignoreNetwork Ignore network rules (optional, default is false).
 * @param ignoreCosmetic Ignore cosmetic rules (optional, default is false).
 * @param ignoreHost Ignore host rules (optional, default is true).
 *
 * @returns Rule instance.
 *
 * @throws Error if the rule is not a valid rule.
 */
export const createRule = (
    rule: string | AnyRule,
    filterListId = 0,
    ruleIndex = RULE_INDEX_NONE,
    ignoreNetwork = false,
    ignoreCosmetic = false,
    ignoreHost = true,
): IRule | null => {
    let node: AnyRule;

    if (isString(rule)) {
        node = RuleParser.parse(rule.trim(), {
            ...defaultParserOptions,
            parseHostRules: !ignoreHost,
        });
    } else {
        node = rule;
    }

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
        node,
        filterListId,
        ruleIndex,
    );
};
