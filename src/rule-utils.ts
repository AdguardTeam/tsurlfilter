import { CosmeticRule } from './cosmetic-rule';
import { NetworkRule } from './network-rule';
import { IRule } from './rule';
import { findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { RuleConverter } from './rules/rule-converter';

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

        let conversionResult;
        try {
            conversionResult = RuleConverter.convertRule(line);
        } catch (ex) {
            // console.debug('Cannot convert rule from filter {0}: {1}, cause {2}', filterId || 0, ruleText, ex);
            // TODO: Log error
        }

        if (!conversionResult) {
            return null;
        }

        // TODO: Support array conversion result
        if (conversionResult.length !== 1) {
            return null;
        }

        const resultRule = conversionResult[0];

        try {
            if (RuleUtils.isCosmetic(resultRule)) {
                return new CosmeticRule(resultRule, filterListId);
            }

            return new NetworkRule(resultRule, filterListId);
        } catch (e) {
            // TODO: Log error
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
}
