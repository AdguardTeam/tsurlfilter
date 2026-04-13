import { type ConversionError } from '../errors/conversion-errors';
import { type LimitationError } from '../errors/limitation-errors';
import { type IRuleset } from '../ruleset/ruleset';
import { type UpdateStaticRulesOptions } from '../ruleset/types';

/**
 * The result of the conversion from filter with string rules to ruleset
 * with declarative rules.
 *
 * @template T The type of the rule set. Defaults to {@link IRuleset}.
 */
export interface ConversionResult<T = IRuleset> {
    /**
     * Rule set with all the information about the declarative rules.
     */
    ruleSet: T;

    /**
     * Errors that may have occurred during the conversion.
     */
    errors: (ConversionError | Error)[];

    /**
     * If the resulting declarative rules have been truncated,
     * information about it will be found in the limitations section.
     */
    limitations: LimitationError[];

    /**
     * If there were $badfilter rules in the input raw dynamic rules and a list
     * of already converted declarative rules from static filters, the result of
     * the conversion can contain a list of declarative rules that
     * should be canceled.
     */
    declarativeRulesToCancel?: UpdateStaticRulesOptions[];
}
