import { type DeclarativeRule } from '../../declarative-rule';
import { type NetworkRule } from '../../network-rule';

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
     * @param networkRule {@link NetworkRule}.
     * @param declarativeRule {@link DeclarativeRule}.
     */
    constructor(
        message: string,
        networkRule: NetworkRule,
        declarativeRule: DeclarativeRule,
    ) {
        super(message, networkRule, declarativeRule);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, EmptyDomainsError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;
    }
}
