import { NetworkRule } from '../../../network-rule';
import { DeclarativeRule } from '../../declarative-rule';

import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';

/**
 * Describes error when converted rule contains too complex regexp error.
 */
export class TooComplexRegexpError extends InvalidDeclarativeRuleError {
    /**
     * Describes error when converted rule contains too complex regexp error.
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

        this.name = 'TooComplexRegexpError';

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, TooComplexRegexpError.prototype);
    }
}
