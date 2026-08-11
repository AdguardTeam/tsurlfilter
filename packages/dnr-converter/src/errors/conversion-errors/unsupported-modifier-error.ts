import { type Rule } from '../../rule/rule';

/**
 * Describes an error when a source network rule contains some of the unsupported modifiers.
 */
export class UnsupportedModifierError extends Error {
    /**
     * {@link Rule} related to this error.
     */
    public rule: Rule;

    /**
     * Describes an error when a source network rule contains some of the unsupported modifiers.
     *
     * @param message Message of error.
     * @param rule {@link Rule}.
     */
    constructor(
        message: string,
        rule: Rule,
    ) {
        super(message);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnsupportedModifierError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.rule = rule;
    }
}
