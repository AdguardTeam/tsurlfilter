import { TooManyError } from './too-many-error';

/**
 * @typedef {import('../../source-map').Source} Source
 */

/**
 * Describes an error when the maximum number of regexp rules is reached.
 */
export class TooManyRegexpRulesError extends TooManyError {
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
        super(
            message,
            excludedRulesIds,
            numberOfMaximumRules,
            numberOfExcludedDeclarativeRules,
        );

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, TooManyRegexpRulesError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;
    }
}
