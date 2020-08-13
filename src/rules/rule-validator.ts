import { CosmeticRule } from './cosmetic-rule';
import { RuleFactory } from './rule-factory';
import { NetworkRule } from './network-rule';

interface ValidationResult {
    valid: boolean;
    error: string | null;
}

export class RuleValidator {
    /**
     * Creates validation result
     * @param valid
     * @param error
     * @private
     */
    public static createValidationResult(valid: boolean, error?: string): ValidationResult {
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
