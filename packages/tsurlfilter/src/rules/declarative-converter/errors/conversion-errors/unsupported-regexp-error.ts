import { type DeclarativeRule } from '../../declarative-rule';
import { type NetworkRuleWithNodeAndText } from '../../network-rule-with-node-and-text';

import { InvalidDeclarativeRuleError } from './invalid-declarative-rule-error';

/**
 * Describes an error when the converted rule contains an unsupported RE2
 * regexp syntax error.
 *
 * @see https://github.com/google/re2/wiki/Syntax
 */
export class UnsupportedRegexpError extends InvalidDeclarativeRuleError {
    /**
     * Describes an error when the converted rule contains an unsupported RE2
     * regexp syntax error.
     *
     * @param message Message of error.
     * @param networkRule {@link NetworkRuleWithNodeAndText}.
     * @param declarativeRule {@link DeclarativeRule}.
     * @param reason Describes a reason of the error.
     */
    constructor(
        message: string,
        networkRule: NetworkRuleWithNodeAndText,
        declarativeRule: DeclarativeRule,
        reason?: string,
    ) {
        super(message, networkRule, declarativeRule);

        this.name = this.constructor.name;

        this.reason = reason;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnsupportedRegexpError.prototype);
    }
}
