import { type DeclarativeRule } from '../../declarative-rule';
import { type NetworkRule } from '../../network-rule';

/**
 * Describes abstract error when declarative rule is invalid.
 */
export abstract class InvalidDeclarativeRuleError extends Error {
    /**
     * {@link NetworkRule} that is invalid.
     */
    public networkRule: NetworkRule;

    /**
     * {@link DeclarativeRule} that is invalid.
     */
    public declarativeRule: DeclarativeRule;

    /**
     * Describes a reason of the error.
     */
    public reason?: string;

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

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, InvalidDeclarativeRuleError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.declarativeRule = declarativeRule;
        this.networkRule = networkRule;
    }
}
