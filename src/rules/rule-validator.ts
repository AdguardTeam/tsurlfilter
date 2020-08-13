import { CosmeticRule } from './cosmetic-rule';
import { RuleFactory } from './rule-factory';
import { NetworkRule, NetworkRuleOption } from './network-rule';
import { Compatibility, config } from '../configuration';

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

    private static validateRuleCompatibility(rule: NetworkRule): void {
        if (config.compatibility === Compatibility.extension) {
            if (rule.isOptionEnabled(NetworkRuleOption.Network)
                || rule.isOptionEnabled(NetworkRuleOption.App)) {
                // eslint-disable-next-line max-len
                throw new SyntaxError(`Rule modificator is not supported: "${rule.getText()}", compatibility: "${config.compatibility}"`);
            }
        }
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
            const rule = new NetworkRule(ruleText, 0);
            this.validateRuleCompatibility(rule);
        } catch (e) {
            return RuleValidator.createValidationResult(false, e.message);
        }

        return RuleValidator.createValidationResult(true);

        // TODO validate host rules
    }
}
