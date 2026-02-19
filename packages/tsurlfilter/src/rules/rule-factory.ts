import {
    NetworkRuleType,
    RuleCategory,
    RuleGenerator,
    RuleParser,
} from '@adguard/agtree';
import { defaultParserOptions } from '@adguard/agtree/parser';
import { getErrorMessage } from '@adguard/logger';

import { logger } from '../utils/logger';

import { createAllowlistRuleNode } from './allowlist';
import { CosmeticRule } from './cosmetic-rule';
import { HostRule } from './host-rule';
import { NetworkRule } from './network-rule';
import { FILTER_LIST_ID_NONE, type IRule, RULE_INDEX_NONE } from './rule';

/**
 * Rule builder class.
 */
export class RuleFactory {
    /**
     * Creates rule of suitable class from text string.
     * It returns null if the line is empty or if it is a comment.
     *
     * This method avoids double parsing by trying to create each rule type directly.
     *
     * @param ruleText Rule text to parse.
     * @param filterListId List id.
     * @param ruleIndex Line start index in the source filter list; it will be used to find the original rule text
     * in the filtering log when a rule is applied. Default value is {@link RULE_INDEX_NONE} which means that
     * the rule does not have source index.
     * @param parseHostRules Whether to parse host rules. Default is true.
     * @param parseHtmlFilteringRuleBodies Whether to parse HTML filtering rule bodies. Default is false.
     *
     * @returns IRule object or null.
     */
    public static createRule(
        ruleText: string,
        filterListId: number = FILTER_LIST_ID_NONE,
        ruleIndex = RULE_INDEX_NONE,
        parseHostRules = true,
        parseHtmlFilteringRuleBodies = false,
    ): IRule | null {
        try {
            const node = RuleParser.parse(ruleText, {
                ...defaultParserOptions,
                parseHostRules,
                parseHtmlFilteringRuleBodies,
            });

            switch (node.category) {
                case RuleCategory.Invalid:
                case RuleCategory.Empty:
                case RuleCategory.Comment:
                    return null;

                case RuleCategory.Cosmetic:
                    return new CosmeticRule(ruleText, filterListId, ruleIndex, node);

                case RuleCategory.Network:
                    if (node.type === NetworkRuleType.HostRule) {
                        if (!parseHostRules) {
                            return null;
                        }

                        return new HostRule(ruleText, filterListId, ruleIndex, node);
                    }

                    return new NetworkRule(ruleText, filterListId, ruleIndex, node);

                default:
                    // should not happen in normal operation
                    return null;
            }
        } catch (e) {
            logger.debug(`[tsurl.RuleFactory.createRule]: failed to create rule from text: ${ruleText}, got ${getErrorMessage(e)}`);
        }

        return null;
    }

    /**
     * Creates allowlist rule for domain.
     *
     * @param domain Domain name.
     * @param filterListId List id.
     * @param ruleIndex Line start index in the source filter list.
     *
     * @returns Allowlist rule or null.
     */
    public static createAllowlistRule(
        domain: string,
        filterListId: number,
        ruleIndex = RULE_INDEX_NONE,
    ): null | NetworkRule {
        const node = createAllowlistRuleNode(domain);

        if (!node) {
            return null;
        }

        // Generate rule text from the node
        const ruleText = RuleGenerator.generate(node);

        return new NetworkRule(ruleText, filterListId, ruleIndex);
    }
}
