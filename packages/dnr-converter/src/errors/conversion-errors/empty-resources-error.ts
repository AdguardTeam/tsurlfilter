import { type DeclarativeRule } from '../../declarative-rule';
import { type NetworkRule } from '../../network-rule';

import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';

/**
 * Describes error when converted rule contains empty list of resources types.
 *
 * @see {@link InvalidDeclarativeRuleError} parent class.
 */
export class EmptyResourcesError extends InvalidDeclarativeRuleError {
    /**
     * Describes error when converted rule contains empty list of resources types.
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
        Object.setPrototypeOf(this, EmptyResourcesError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;
    }
}
