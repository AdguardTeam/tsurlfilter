import { type DeclarativeRule } from '../../declarative-rule';
import { type Rule } from '../../rule/rule';

import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';

/**
 * Describes error when converted rule contains an empty list of domains, but original contains.
 *
 * @see {@link InvalidDeclarativeRuleError} parent class.
 */
export class EmptyDomainsError extends InvalidDeclarativeRuleError {
    /**
     * Describes error when converted rule contains an empty list of domains, but original contains.
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
        super(message, rule, declarativeRule);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, EmptyDomainsError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;
    }
}
