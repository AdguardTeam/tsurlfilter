/**
 * Describes an error of a rule which could not be parsed or validated while
 * scanning.
 *
 * Unlike a conversion error, such a rule is not available as a parsed rule, so
 * the error keeps the filter id and the line index instead of the rule itself.
 */
export class RuleScanError extends Error {
    /**
     * Id of the filter the rule belongs to.
     */
    public filterId: number;

    /**
     * Index of the rule line in the filter list.
     */
    public lineIndex: number;

    /**
     * Describes an error of a rule which could not be parsed or validated
     * while scanning.
     *
     * @param message Message of error.
     * @param filterId Id of the filter the rule belongs to.
     * @param lineIndex Index of the rule line in the filter list.
     * @param cause Captured error.
     */
    constructor(message: string, filterId: number, lineIndex: number, cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause });

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, RuleScanError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.filterId = filterId;
        this.lineIndex = lineIndex;
    }
}

/**
 * Type guard for {@link RuleScanError}.
 *
 * @param error The error to check.
 *
 * @returns `true` if the error is a {@link RuleScanError}, `false` otherwise.
 */
export function isRuleScanError(error: unknown): error is RuleScanError {
    return error instanceof RuleScanError;
}
