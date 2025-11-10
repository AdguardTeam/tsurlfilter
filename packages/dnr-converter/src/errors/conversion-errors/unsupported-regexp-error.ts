import { type DeclarativeRule } from '../../declarative-rule';
import { type NetworkRule } from '../../network-rule';

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
     * @param networkRule {@link NetworkRule}.
     * @param declarativeRule {@link DeclarativeRule}.
     * @param reason Describes a reason of the error.
     */
    constructor(
        message: string,
        networkRule: NetworkRule,
        declarativeRule: DeclarativeRule,
        reason?: string,
    ) {
        super(message, networkRule, declarativeRule);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnsupportedRegexpError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.reason = reason;
    }
}
