/**
 * Describes error when maximum number of rules is equal or less than `0`.
 */
export class EmptyOrNegativeNumberOfRulesError extends Error {
    /**
     * Describes error when maximum number of rules is equal or less than `0`.
     *
     * @param message Message of error.
     */
    constructor(message: string) {
        super(message);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, EmptyOrNegativeNumberOfRulesError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;
    }
}
