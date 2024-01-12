import {
    AnyRule,
    CommentRuleParser,
    RuleCategory,
    RuleParser,
} from '@adguard/agtree';

import { CosmeticRule } from './cosmetic-rule';
import { NetworkRule } from './network-rule';
import { IRule } from './rule';
import { findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { HostRule } from './host-rule';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../common/error';

/**
 * Rule builder class
 */
export class RuleFactory {
    /**
     * Helper method to get the rule node.
     *
     * @param input Rule, can be either a string or a {@link NetworkRuleNode}.
     * @returns Rule node.
     */
    public static getRuleNode(input: string | AnyRule): AnyRule {
        let node: AnyRule;
        if (typeof input === 'string') {
            node = RuleParser.parse(input.trim(), {
                isLocIncluded: false,
                parseAbpSpecificRules: false,
                parseUboSpecificRules: false,
                // FIXME: ignore comments here
            });
        } else {
            node = input;
        }

        return node;
    }

    /**
     * Creates rule of suitable class from text string
     * It returns null if the line is empty or if it is a comment
     *
     * TODO: Pack `ignore*` parameters and `silent` into one object with flags.
     *
     * @param input rule text or {@link AnyRule}
     * @param filterListId list id
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
        input: AnyRule | string,
        filterListId: number,
        ignoreNetwork = false,
        ignoreCosmetic = false,
        ignoreHost = true,
        silent = true,
    ): IRule | null {
        const node = RuleFactory.getRuleNode(input);

        if (
            node.category === RuleCategory.Comment // FIXME
            || node.category === RuleCategory.Empty
            || node.category === RuleCategory.Invalid
        ) {
            return null;
        }

        // FIXME:
        // if (RuleFactory.isShort(text)) {
        //     logger.info(`The rule is too short: ${text}`);
        // }

        try {
            if (node.category === RuleCategory.Cosmetic) {
                if (ignoreCosmetic) {
                    return null;
                }

                return new CosmeticRule(node, filterListId);
            }

            // FIXME
            // if (!ignoreHost) {
            //     const hostRule = RuleFactory.createHostRule(line, filterListId);
            //     if (hostRule) {
            //         return hostRule;
            //     }
            // }

            if (!ignoreNetwork) {
                return new NetworkRule(node, filterListId);
            }
        } catch (e) {
            const msg = `"${getErrorMessage(e)}" in the rule: "${node}"`; // FIXME
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
     * @param ruleText
     * @param filterListId
     */
    private static createHostRule(ruleText: string, filterListId: number): HostRule | null {
        const rule = new HostRule(ruleText, filterListId);
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
