import { type NetworkRule } from '../../../network-rule';
import { type DeclarativeRule } from '../../declarative-rule';

/**
 * Describes abstract error when declarative rule is invalid.
 */
export abstract class InvalidDeclarativeRuleError extends Error {
    networkRule: NetworkRule;

    declarativeRule: DeclarativeRule;

    /**
     * Describes a reason of the error.
     */
    reason?: string;

    /**
     * Describes abstract error when declarative rule is invalid.
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
        super(message);

        this.name = 'InvalidDeclarativeRuleError';
        this.networkRule = networkRule;
        this.declarativeRule = declarativeRule;
        this.reason = reason;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, InvalidDeclarativeRuleError.prototype);
    }
}
