import { TooManyError } from './too-many-error';

/**
 * @typedef {import('../../ruleset/source-map').Source} Source
 */

/**
 * Describes an error when the maximum number of unsafe rules is reached.
 *
 * {@link TooManyError.excludedRulesIds} also lists the unsafe source rules
 * that the total limit drops, so, when this error is created, a consumer can
 * account for the unsafe rules that these two limits exclude. The list holds
 * one id per source rule of each excluded declarative rule, so its length can
 * differ from the number of excluded unsafe rules. It does not include unsafe
 * rules that the regexp limit drops, and
 * {@link TooManyError.numberOfExcludedDeclarativeRules} counts only the unsafe
 * rules that exceed the limit.
 */
export class TooManyUnsafeRulesError extends TooManyError {
    /**
     * Describes an error when the maximum number of unsafe rules is reached.
     *
     * @param message Message of error.
     * @param excludedRulesIds List of excluded source (important!) {@link Source} rules ids.
     * @param numberOfMaximumRules Number of maximum rules.
     * @param numberOfExcludedDeclarativeRules Number of excluded declarative rules.
     */
    constructor(
        message: string,
        excludedRulesIds: number[],
        numberOfMaximumRules: number,
        numberOfExcludedDeclarativeRules: number,
    ) {
        super(
            message,
            excludedRulesIds,
            numberOfMaximumRules,
            numberOfExcludedDeclarativeRules,
        );

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, TooManyUnsafeRulesError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;
    }
}
