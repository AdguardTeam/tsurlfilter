import { type DeclarativeRule } from '../../declarative-rule';
import { type Rule } from '../../rule/rule';

import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';

/**
 * Describes an error when the converted rule contains an unsupported RE2 regexp syntax error.
 *
 * @see {@link InvalidDeclarativeRuleError} parent class.
 * @see https://github.com/google/re2/wiki/Syntax
 */
export class UnsupportedRegexpError extends InvalidDeclarativeRuleError {
    /**
     * Describes an error when the converted rule contains an unsupported RE2 regexp syntax error.
     *
     * @param message Message of error.
     * @param rule {@link Rule}.
     * @param declarativeRule {@link DeclarativeRule}.
     * @param reason Describes a reason of the error.
     */
    constructor(
        message: string,
        rule: Rule,
        declarativeRule: DeclarativeRule,
        reason?: string,
    ) {
        super(message, rule, declarativeRule);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnsupportedRegexpError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.reason = reason;
    }
}
