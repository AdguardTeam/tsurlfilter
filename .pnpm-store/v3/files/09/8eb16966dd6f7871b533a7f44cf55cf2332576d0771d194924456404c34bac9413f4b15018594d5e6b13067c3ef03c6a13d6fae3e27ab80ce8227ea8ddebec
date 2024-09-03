import type { ConversionError } from './errors/conversion-errors';
import type { LimitationError } from './errors/limitation-errors';
import type { IRuleSet, UpdateStaticRulesOptions } from './rule-set';

/**
 * The result of the conversion from filter with string rules to ruleset
 * with declarative rules.
 */
export interface ConversionResult {
    /**
     * Rule set with all the information about the declarative rules.
     */
    ruleSet: IRuleSet,
    /**
     * Errors that may have occurred during the conversion.
     */
    errors: (ConversionError | Error)[],
    /**
     * If the resulting declarative rules have been truncated,
     * information about it will be found in the limitations section.
     */
    limitations: LimitationError[],
    /**
     * If there were $badfilter rules in the input raw dynamic rules and a list
     * of already converted declarative rules from static filters, the result of
     * the conversion can contain a list of declarative rules that
     * should be canceled.
     */
    declarativeRulesToCancel?: UpdateStaticRulesOptions[],
}
