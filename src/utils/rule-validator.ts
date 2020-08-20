import { CosmeticRule } from '../rules/cosmetic-rule';
import { RuleFactory } from '../rules/rule-factory';
import { NetworkRule } from '../rules/network-rule';
import { SimpleRegex } from '../rules/simple-regex';

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

    private static validateRegexp(pattern: string, ruleText: string): void {
        if (pattern.startsWith(SimpleRegex.MASK_REGEX_RULE)
            && pattern.endsWith(SimpleRegex.MASK_REGEX_RULE)) {
            try {
                new RegExp(pattern.slice(1, -1));
            } catch (e) {
                throw new SyntaxError(`Rule has invalid regex pattern: "${ruleText}"`);
            }
        }
    }

    /**
     * Validates raw rule string
     * @param rawRule
     */
    public static validate(rawRule: string): ValidationResult {
        const ruleText = rawRule.trim();

        if (!ruleText || RuleFactory.isComment(ruleText)) {
            return RuleValidator.createValidationResult(true);
        }

        if (RuleFactory.isShort(ruleText)) {
            return RuleValidator.createValidationResult(false, `Rule is too short: ${ruleText}`);
        }

        try {
            // Validate cosmetic rules
            if (RuleFactory.isCosmetic(ruleText)) {
                new CosmeticRule(ruleText, 0);
                return RuleValidator.createValidationResult(true);
            }

            // Validate network rules
            const rule = new NetworkRule(ruleText, 0);
            RuleValidator.validateRegexp(rule.getPattern(), rule.getText());
        } catch (e) {
            const errorMessage = `Error: "${e.message}" in the rule: "${ruleText}"`;
            return RuleValidator.createValidationResult(false, errorMessage);
        }

        return RuleValidator.createValidationResult(true);

        // TODO validate host rules
    }
}
