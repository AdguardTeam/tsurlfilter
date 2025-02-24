import { type DeclarativeRule } from '../../declarative-rule';
import { type NetworkRuleWithNode } from '../../network-rule-with-node';

/**
 * Describes abstract error when declarative rule is invalid.
 */
export abstract class InvalidDeclarativeRuleError extends Error {
    networkRule: NetworkRuleWithNode;

    declarativeRule: DeclarativeRule;

    /**
     * Describes a reason of the error.
     */
    reason?: string;

    /**
     * Describes abstract error when declarative rule is invalid.
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
        super(message);

        this.name = this.constructor.name;
        this.declarativeRule = declarativeRule;
        this.networkRule = networkRule;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, InvalidDeclarativeRuleError.prototype);
    }
}
