import { type NetworkRule } from '../../../network-rule';
import { type DeclarativeRule } from '../../declarative-rule';

/**
 * Describes abstract error when declarative rule is invalid.
 */
export abstract class InvalidDeclarativeRuleError extends Error {
    networkRule: NetworkRule;

    declarativeRule: DeclarativeRule;

    /**
     * Describes abstract error when declarative rule is invalid.
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
        super(message);

        this.name = 'InvalidDeclarativeRuleError';
        this.networkRule = networkRule;
        this.declarativeRule = declarativeRule;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, InvalidDeclarativeRuleError.prototype);
    }
}
