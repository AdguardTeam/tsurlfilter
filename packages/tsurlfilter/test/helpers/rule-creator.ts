import { type AnyCosmeticRule, type AnyRule, type NetworkRule as NetworkRuleNode } from '@adguard/agtree';
import {
    defaultParserOptions,
    RuleParser,
    CosmeticRuleParser,
    NetworkRuleParser,
} from '@adguard/agtree/parser';
import { isString } from 'lodash-es';

import {
    CosmeticRule,
    type IRule,
    NetworkRule,
    RULE_INDEX_NONE,
    RuleFactory,
} from '../../src';
import { NetworkRuleWithNode } from '../../src/rules/declarative-converter/network-rule-with-node';

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
 * Helper function to create a network rule from a string or a parsed node.
 * This is needed because the default API for creating a network rule only accepts nodes,
 * but it's more convenient to create rules from strings.
 *
 * @param rule Rule string or parsed node.
 * @param filterListId Filter list ID (optional, default is 0).
 * @param ruleIndex Rule index (optional, default is {@link RULE_INDEX_NONE}).
 *
 * @returns Network rule with node instance.
 *
 * @throws Error if the rule is not a valid network rule.
 */
export const createNetworkRuleWithNode = (
    rule: string | NetworkRuleNode,
    filterListId = 0,
    ruleIndex = RULE_INDEX_NONE,
): NetworkRuleWithNode => {
    let node: NetworkRuleNode;

    if (isString(rule)) {
        node = NetworkRuleParser.parse(rule.trim());
    } else {
        node = rule;
    }

    return new NetworkRuleWithNode(
        new NetworkRule(node, filterListId, ruleIndex),
        node,
    );
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
 * @param silent Silent mode (optional, default is true).
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
    silent = true,
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

    return RuleFactory.createRule(
        node,
        filterListId,
        ruleIndex,
        ignoreNetwork,
        ignoreCosmetic,
        ignoreHost,
        silent,
    );
};
