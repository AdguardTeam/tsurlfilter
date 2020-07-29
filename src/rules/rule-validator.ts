import { findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { CosmeticRule } from './cosmetic-rule';

interface ValidationResult {
    result: boolean;
    error: string | null;
}

export class RuleValidator {
    /**
     * Checks if rule is short
     */
    public static isShort(rule: string): boolean {
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
    public static createValidationResult(result: boolean, error?: string): ValidationResult {
        if (error) {
            return { result, error };
        }

        return { result, error: null };
    }

    /**
     * Validates raw cosmetic rule string
     * @param rule
     * @private
     */
    private static validateCosmeticRule(rule: string): ValidationResult {
        const [index, marker] = findCosmeticRuleMarker(rule);

        if (index < 0 || marker === null) {
            return this.createValidationResult(false, `Rule is not a cosmetic rule: ${rule}`);
        }

        let type;
        try {
            type = CosmeticRule.determineType(marker);
        } catch (e) {
            return this.createValidationResult(false, `Rule: ${rule} doesn't support marker: ${marker}`);
        }

        const content = rule.substring(index + marker.length).trim();
        if (!content) {
            return this.createValidationResult(false, `Rule content is empty: ${rule}`);
        }

        try {
            CosmeticRule.validate(rule, type, content);
        } catch (e) {
            return this.createValidationResult(false, e.message);
        }

        return this.createValidationResult(true);
    }

    /**
     * Validates raw rule string
     * @param rawRule
     */
    public static validate(rawRule: string): ValidationResult {
        const rule = rawRule.trim();

        if (RuleValidator.isShort(rule)) {
            return RuleValidator.createValidationResult(false, `Rule is too short: ${rule}`);
        }

        if (RuleValidator.isComment(rule)) {
            return RuleValidator.createValidationResult(true);
        }

        if (RuleValidator.isCosmetic(rule)) {
            // TODO add tests for this part
            return RuleValidator.validateCosmeticRule(rule);
        }

        return RuleValidator.createValidationResult(true);
    }
}
