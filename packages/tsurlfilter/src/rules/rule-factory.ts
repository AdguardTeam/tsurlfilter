import { CosmeticRule } from './cosmetic-rule';
import { NetworkRule } from './network-rule';
import { IRule } from './rule';
import { findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { HostRule } from './host-rule';
import { logger } from '../utils/logger';

/**
 * Rule builder class
 */
export class RuleFactory {
    /**
     * Creates rule of suitable class from text string
     * It returns null if the line is empty or if it is a comment
     *
     * @param text rule string
     * @param filterListId list id
     * @param ignoreNetwork do not create network rules
     * @param ignoreCosmetic do not create cosmetic rules
     * @param ignoreHost do not create host rules
     * @return IRule object or null
     */
    public static createRule(
        text: string, filterListId: number, ignoreNetwork = false, ignoreCosmetic = false, ignoreHost = true,
    ): IRule | null {
        if (!text || RuleFactory.isComment(text)) {
            return null;
        }

        if (RuleFactory.isShort(text)) {
            logger.info(`The rule is too short: ${text}`);
        }

        const line = text.trim();

        try {
            if (RuleFactory.isCosmetic(line)) {
                if (ignoreCosmetic) {
                    return null;
                }

                return new CosmeticRule(line, filterListId);
            }

            if (!ignoreHost) {
                const hostRule = RuleFactory.createHostRule(line, filterListId);
                if (hostRule) {
                    return hostRule;
                }
            }

            if (!ignoreNetwork) {
                return new NetworkRule(line, filterListId);
            }
        } catch (e) {
            logger.info(`Error: "${e.message}" in the rule: "${line}"`);
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
        if (text.charAt(0) === '!') {
            return true;
        }

        if (text.charAt(0) === '#') {
            if (text.length === 1) {
                return true;
            }

            // Now we should check that this is not a cosmetic rule
            return !RuleFactory.isCosmetic(text);
        }

        return false;
    }
}
