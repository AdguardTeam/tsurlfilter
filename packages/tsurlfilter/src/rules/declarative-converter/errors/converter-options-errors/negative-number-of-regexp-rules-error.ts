/**
 * Describes error when maximum number of rules is less than 0.
 */
export class NegativeNumberOfRegexpRulesError extends Error {
    /**
     * Describes error when maximum number of rules is less than 0.
     *
     * @param message Message of error.
     */
    constructor(message: string) {
        super(message);

        this.name = 'NegativeNumberOfRegexpRulesError';

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, NegativeNumberOfRegexpRulesError.prototype);
    }
}
