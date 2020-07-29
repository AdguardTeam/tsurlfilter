import { findCosmeticRuleMarker } from './cosmetic-rule-marker';

interface ValidationResult {
    result: boolean;
    error: string | null;
}

export class RuleValidator {
    /**
     * Checks if rule is short
     */
    private static isShort(rule: string): boolean {
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
            return !RuleValidator.isCosmetic(text);
        }

        return false;
    }

    /**
     * Creates validation result
     * @param result
     * @param error
     * @private
     */
    public static createResult(result: boolean, error?: string): ValidationResult {
        if (error) {
            return { result, error };
        }

        return { result, error: null };
    }

    public static validate(rawRule: string): ValidationResult {
        const rule = rawRule.trim();

        if (RuleValidator.isShort(rule)) {
            return RuleValidator.createResult(false, `Rule is too short: ${rule}`);
        }

        if (RuleValidator.isComment(rule)) {
            return RuleValidator.createResult(true);
        }

        return RuleValidator.createResult(true);
    }
}
