import { CosmeticRule } from './cosmetic-rule';
import { NetworkRule } from './network-rule';
import { IRule } from './rule';
import { findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { HostRule } from './host-rule';
import { logger } from '../utils/logger';

/**
 * Rule builder class
 */
export class RuleUtils {
    /**
     * Creates rule of suitable class from text string
     * It returns null if the line is empty or if it is a comment
     *
     * @param text rule string
     * @param filterListId list id
     * @return IRule object or null
     */
    public static createRule(text: string, filterListId: number): IRule | null {
        if (!text || RuleUtils.isComment(text)) {
            return null;
        }

        const line = text.trim();
        try {
            if (RuleUtils.isCosmetic(line)) {
                return new CosmeticRule(line, filterListId);
            }

            const hostRule = RuleUtils.createHostRule(line, filterListId);
            if (hostRule) {
                return hostRule;
            }

            return new NetworkRule(line, filterListId);
        } catch (e) {
            logger.error(e);
        }

        return null;
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
            return !RuleUtils.isCosmetic(text);
        }

        return false;
    }

    /**
     * Detects if the rule is cosmetic or not.
     *
     * @param ruleText - rule text to check.
     */
    public static isCosmetic(ruleText: string): boolean {
        const marker = findCosmeticRuleMarker(ruleText);
        return marker[0] !== -1;
    }

    /**
     * Creates host rule from text
     *
     * @param ruleText
     * @param filterListId
     */
    private static createHostRule(ruleText: string, filterListId: number): HostRule | null {
        try {
            return new HostRule(ruleText, filterListId);
        } catch (e) {
            // Ignore
        }

        return null;
    }
}
