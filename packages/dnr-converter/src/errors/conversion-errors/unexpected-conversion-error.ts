import { type Rule } from '../../rule/rule';

/**
 * Describes an error of a rule which failed with an unexpected error.
 */
export class UnexpectedConversionError extends Error {
    /**
     * {@link Rule} related to this error.
     */
    public rule: Rule;

    /**
     * Describes an error of a rule which failed with an unexpected error.
     *
     * @param message Message of error.
     * @param rule {@link Rule}.
     * @param cause Captured error.
     */
    constructor(
        message: string,
        rule: Rule,
        cause: unknown,
    ) {
        super(message, { cause });

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnexpectedConversionError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.rule = rule;
    }
}
