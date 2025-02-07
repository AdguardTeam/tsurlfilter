/**
 * @typedef {import('../../source-map').Source} Source
 */

/**
 * Describes an error when the maximum number of regexp rules is reached.
 */
export class TooManyRegexpRulesError extends Error {
    /**
     * List of excluded source (important!) {@link Source} rules ids.
     */
    excludedRulesIds: number[];

    /**
     * Number of maximum rules.
     */
    numberOfMaximumRules: number;

    /**
     * Number of excluded declarative rules.
     */
    numberOfExcludedDeclarativeRules: number;

    /**
     * Describes an error when the maximum number of regexp rules is reached.
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
        super(message);

        this.name = this.constructor.name;
        this.excludedRulesIds = excludedRulesIds;
        this.numberOfMaximumRules = numberOfMaximumRules;
        this.numberOfExcludedDeclarativeRules = numberOfExcludedDeclarativeRules;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, TooManyRegexpRulesError.prototype);
    }
}
