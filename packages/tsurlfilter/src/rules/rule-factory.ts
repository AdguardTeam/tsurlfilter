import {
    type AnyRule,
    CommentRuleParser,
    NetworkRuleType,
    RuleCategory,
    RuleParser,
    defaultParserOptions,
} from '@adguard/agtree';

import { CosmeticRule } from './cosmetic-rule';
import { NetworkRule } from './network-rule';
import { RULE_INDEX_NONE, type IRule } from './rule';
import { findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { HostRule } from './host-rule';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../common/error';
import { isString } from '../utils/string-utils';

/**
 * Rule builder class
 */
export class RuleFactory {
    /**
     * Creates rule of suitable class from text string
     * It returns null if the line is empty or if it is a comment
     *
     * TODO: Pack `ignore*` parameters and `silent` into one object with flags.
     *
     * @param inputRule rule string
     * @param filterListId list id
     * @param ruleIndex line start index in the source filter list; it will be used to find the original rule text
     * in the filtering log when a rule is applied. Default value is {@link RULE_INDEX_NONE} which means that
     * the rule does not have source index
     * @param ignoreNetwork do not create network rules
     * @param ignoreCosmetic do not create cosmetic rules
     * @param ignoreHost do not create host rules
     * @param silent Log the error for `true`, otherwise throw an exception on
     * a rule creation
     *
     * @throws Error when `silent` flag is passed as false on rule creation error.
     *
     * @return IRule object or null
     */
    public static createRule(
        inputRule: string | AnyRule,
        filterListId: number,
        ruleIndex = RULE_INDEX_NONE,
        ignoreNetwork = false,
        ignoreCosmetic = false,
        ignoreHost = true,
        silent = true,
    ): IRule | null {
        let ruleNode: AnyRule;

        try {
            if (isString(inputRule)) {
                ruleNode = RuleParser.parse(inputRule.trim(), {
                    ...defaultParserOptions,
                    isLocIncluded: false,
                    includeRaws: true,
                    parseHostRules: !ignoreHost,
                });
            } else {
                ruleNode = inputRule;
            }

            switch (ruleNode.category) {
                case RuleCategory.Invalid:
                case RuleCategory.Empty:
                case RuleCategory.Comment:
                    return null;

                case RuleCategory.Cosmetic:
                    if (ignoreCosmetic) {
                        return null;
                    }

                    return new CosmeticRule(ruleNode, filterListId, ruleIndex);

                case RuleCategory.Network:
                    if (ruleNode.type === NetworkRuleType.HostRule) {
                        if (ignoreHost) {
                            return null;
                        }

                        return new HostRule(ruleNode, filterListId, ruleIndex);
                    }

                    if (ignoreNetwork) {
                        return null;
                    }

                    return new NetworkRule(ruleNode, filterListId, ruleIndex);

                default:
                    // should not happen in normal operation
                    return null;
            }
        } catch (e) {
            const msg = `"${getErrorMessage(e)}" in the rule: "${inputRule}"`;
            if (silent) {
                logger.info(`Error: ${msg}`);
            } else {
                throw new Error(msg);
            }
        }

        return null;
    }

    /**
     * Creates host rule from text
     *
     * @param ruleText Rule text
     * @param filterListId Filter list id
     * @param ruleIndex line start index in the source filter list; it will be used to find the original rule text
     * in the filtering log when a rule is applied. Default value is {@link RULE_INDEX_NONE} which means that
     * the rule does not have source index
     */
    private static createHostRule(ruleText: string, filterListId: number, ruleIndex: number): HostRule | null {
        const rule = new HostRule(ruleText, filterListId, ruleIndex);
        return rule.isInvalid() ? null : rule;
    }

    /**
     * Checks if rule is short
     */
    public static isShort(rule: string): boolean {
        if (!rule) {
            return true;
        }
        return !!(rule && rule.length <= 3);
    }

    /**
     * Checks if the rule is cosmetic or not.
     * @param ruleText - rule text to check.
     */
    public static isCosmetic(ruleText: string): boolean {
        const marker = findCosmeticRuleMarker(ruleText);
        return marker[0] !== -1;
    }

    /**
     * If text is comment
     *
     * @param text
     */
    public static isComment(text: string): boolean {
        return CommentRuleParser.isCommentRule(text);
    }
}
