import { type AnyCosmeticRule, type AnyRule, type NetworkRule as NetworkRuleNode } from '@adguard/agtree';
import {
    CosmeticRuleParser,
    defaultParserOptions,
    NetworkRuleParser,
    RuleParser,
} from '@adguard/agtree/parser';
import { isString } from 'lodash-es';

import { CosmeticRule } from '../../src/rules/cosmetic-rule';
import { NetworkRuleWithNodeAndText } from '../../src/rules/declarative-converter/network-rule-with-node-and-text';
import { NetworkRule } from '../../src/rules/network-rule';
import { type IRule, RULE_INDEX_NONE } from '../../src/rules/rule';
import { RuleFactory } from '../../src/rules/rule-factory';

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
 * @param text Rule text.
 * @param filterListId Filter list ID (optional, default is 0).
 * @param ruleIndex Rule index (optional, default is {@link RULE_INDEX_NONE}).
 *
 * @returns Network rule with node instance.
 *
 * @throws Error if the rule is not a valid network rule.
 */
export const createNetworkRuleWithNode = (
    text: string,
    filterListId = 0,
    ruleIndex = RULE_INDEX_NONE,
): NetworkRuleWithNodeAndText => {
    let node: NetworkRuleNode;

    if (isString(text)) {
        node = NetworkRuleParser.parse(text.trim());
    } else {
        node = text;
    }

    return new NetworkRuleWithNodeAndText(
        new NetworkRule(node, filterListId, ruleIndex),
        node,
        text,
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
