import { CosmeticRule, CosmeticRuleType } from './cosmetic-rule';
import { ExtendedCssValidator } from './extended-css-validator';
import { RuleFactory } from './rule-factory';
import { NetworkRule } from './network-rule';

interface ValidationResult {
    result: boolean;
    error: string | null;
}

export class RuleValidator {
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

    public static validateExtCss(rule: CosmeticRule): ValidationResult {
        if (rule.getType() === CosmeticRuleType.ElementHiding) {
            try {
                ExtendedCssValidator.validateCssSelector(rule.getContent());
            } catch (e) {
                return this.createValidationResult(false, `${e.message}, rule: ${rule.getText()}`);
            }
        }
        return this.createValidationResult(true);
    }

    /**
     * Validates raw rule string
     * @param rawRule
     */
    public static validate(rawRule: string): ValidationResult {
        const rule = rawRule.trim();

        if (RuleFactory.isShort(rule)) {
            return RuleValidator.createValidationResult(false, `Rule is too short: ${rule}`);
        }

        if (RuleFactory.isComment(rule)) {
            return RuleValidator.createValidationResult(true);
        }

        if (RuleFactory.isCosmetic(rule)) {
            try {
                const cosmeticRule = new CosmeticRule(rule, 0);
                RuleValidator.validateExtCss(cosmeticRule);
                return RuleValidator.createValidationResult(true);
            } catch (e) {
                return RuleValidator.createValidationResult(false, e.message);
            }
        }

        try {
            new NetworkRule(rule, 0);
        } catch (e) {
            return RuleValidator.createValidationResult(false, e.message);
        }

        return RuleValidator.createValidationResult(true);
    }
}
