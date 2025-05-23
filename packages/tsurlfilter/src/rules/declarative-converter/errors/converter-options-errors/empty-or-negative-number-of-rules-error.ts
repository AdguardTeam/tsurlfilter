/**
 * Describes error when maximum number of rules is equal or less than 0.
 */
export class EmptyOrNegativeNumberOfRulesError extends Error {
    /**
     * Describes error when maximum number of rules is equal or less than 0.
     *
     * @param message Message of error.
     */
    constructor(message: string) {
        super(message);

        this.name = this.constructor.name;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, EmptyOrNegativeNumberOfRulesError.prototype);
    }
}
