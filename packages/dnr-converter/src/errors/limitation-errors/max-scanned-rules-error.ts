/**
 * Describes an error when the maximum number of rules is reached and some rules are skipped from scanning.
 */
export class MaxScannedRulesError extends Error {
    /**
     * Line index of the filter from which the rules are skipped.
     */
    public lineIndex: number;

    /**
     * Describes an error when the maximum number of rules is reached and some rules are skipped from scanning.
     *
     * @param message Message of error.
     * @param lineIndex Line index of the filter from which the rules are skipped.
     */
    constructor(message: string, lineIndex: number) {
        super(message);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, MaxScannedRulesError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.lineIndex = lineIndex;
    }
}
