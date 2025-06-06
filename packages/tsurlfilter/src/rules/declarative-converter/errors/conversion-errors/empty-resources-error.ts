import { type DeclarativeRule } from '../../declarative-rule';
import { type NetworkRuleWithNode } from '../../network-rule-with-node';

import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';

/**
 * Describes error when converted rule contains empty list of resources types.
 */
export class EmptyResourcesError extends InvalidDeclarativeRuleError {
    /**
     * Describes error when converted rule contains empty list of resources types.
     *
     * @param message Message of error.
     * @param networkRule {@link NetworkRuleWithNode}.
     * @param declarativeRule {@link DeclarativeRule}.
     */
    constructor(
        message: string,
        networkRule: NetworkRuleWithNode,
        declarativeRule: DeclarativeRule,
    ) {
        super(message, networkRule, declarativeRule);

        this.name = this.constructor.name;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, EmptyResourcesError.prototype);
    }
}
