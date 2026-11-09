/**
 * @typedef {import('../../ruleset/source-map').Source} Source
 */

/**
 * Describes an error when the maximum number of something is reached.
 *
 * Note: This class is intended to be extended by more specific error classes.
 */
export abstract class TooManyError extends Error {
    /**
     * List of excluded source (important!) {@link Source} rules ids.
     *
     * Holds one id per source rule of each excluded declarative rule, so a
     * declarative rule produced from several source rules adds several ids, and
     * a source rule that produces several declarative rules is listed once for
     * each of them that is excluded.
     */
    public excludedRulesIds: number[];

    /**
     * Number of maximum rules.
     */
    public numberOfMaximumRules: number;

    /**
     * Number of excluded declarative rules.
     *
     * Counts declarative rules, so it can differ from the length of
     * {@link excludedRulesIds}, which counts source rules.
     */
    public numberOfExcludedDeclarativeRules: number;

    /**
     * Describes an error when the maximum number of something is reached.
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

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, TooManyError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.excludedRulesIds = excludedRulesIds;
        this.numberOfMaximumRules = numberOfMaximumRules;
        this.numberOfExcludedDeclarativeRules = numberOfExcludedDeclarativeRules;
    }
}
