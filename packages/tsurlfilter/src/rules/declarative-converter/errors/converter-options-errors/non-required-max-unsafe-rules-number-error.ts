/**
 * Describes error when maximum number of unsafe rules is not required.
 */
export class NonRequiredMaxUnsafeRulesNumberError extends Error {
    /**
     * Describes error when maximum number of unsafe rules is not required.
     *
     * @param message Message of error.
     */
    constructor(message: string) {
        super(message);

        this.name = 'NonRequiredMaxUnsafeRulesNumberError';

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, NonRequiredMaxUnsafeRulesNumberError.prototype);
    }
}
