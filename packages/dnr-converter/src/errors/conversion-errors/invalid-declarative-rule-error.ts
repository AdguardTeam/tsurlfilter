import { type DeclarativeRule } from '../../declarative-rule';
import { type Rule } from '../../rule/rule';

/**
 * Describes abstract error when declarative rule is invalid.
 */
export abstract class InvalidDeclarativeRuleError extends Error {
    /**
     * {@link Rule} that is invalid.
     */
    public rule: Rule;

    /**
     * {@link DeclarativeRule} that is invalid.
     */
    public declarativeRule: DeclarativeRule;

    /**
     * Describes a reason of the error.
     */
    public reason?: string;

    /**
     * Describes abstract error when declarative rule is invalid.
     *
     * @param message Message of error.
     * @param rule {@link Rule}.
     * @param declarativeRule {@link DeclarativeRule}.
     */
    constructor(
        message: string,
        rule: Rule,
        declarativeRule: DeclarativeRule,
    ) {
        super(message);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, InvalidDeclarativeRuleError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.declarativeRule = declarativeRule;
        this.rule = rule;
    }
}
