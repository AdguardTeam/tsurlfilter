import { type DeclarativeRule } from '../../declarative-rule';
import { type NetworkRuleWithNodeAndText } from '../../network-rule-with-node-and-text';

import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';

/**
 * Describes error when converted rule contains an empty list of domains, but original contains.
 */
export class EmptyDomainsError extends InvalidDeclarativeRuleError {
    /**
     * Describes error when converted rule contains an empty list of domains, but original contains.
     *
     * @param message Message of error.
     * @param networkRule {@link NetworkRuleWithNodeAndText}.
     * @param declarativeRule {@link DeclarativeRule}.
     */
    constructor(
        message: string,
        networkRule: NetworkRuleWithNodeAndText,
        declarativeRule: DeclarativeRule,
    ) {
        super(message, networkRule, declarativeRule);

        this.name = this.constructor.name;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, EmptyDomainsError.prototype);
    }
}
