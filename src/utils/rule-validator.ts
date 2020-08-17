import { CosmeticRule } from '../rules/cosmetic-rule';
import { RuleFactory } from '../rules/rule-factory';
import { NetworkRule } from '../rules/network-rule';

interface ValidationResult {
    valid: boolean;
    error: string | null;
}

/**
 * Module, which can be used to validate filter rules in other libraries
 */
export class RuleValidator {
    /**
     * Creates validation result
     * @param valid
     * @param error
     * @private
     */
    private static createValidationResult(valid: boolean, error?: string): ValidationResult {
        if (error) {
            return { valid, error };
        }

        return { valid, error: null };
    }

    /**
     * Validates raw rule string
     * @param rawRule
     */
    public static validate(rawRule: string): ValidationResult {
        const ruleText = rawRule.trim();

        if (RuleFactory.isShort(ruleText)) {
            return RuleValidator.createValidationResult(false, `Rule is too short: ${ruleText}`);
        }

        if (RuleFactory.isComment(ruleText)) {
            return RuleValidator.createValidationResult(true);
        }

        if (RuleFactory.isCosmetic(ruleText)) {
            try {
                new CosmeticRule(ruleText, 0);
                return RuleValidator.createValidationResult(true);
            } catch (e) {
                return RuleValidator.createValidationResult(false, e.message);
            }
        }

        try {
            new NetworkRule(ruleText, 0);
        } catch (e) {
            return RuleValidator.createValidationResult(false, e.message);
        }

        return RuleValidator.createValidationResult(true);

        // TODO validate host rules
    }
}
