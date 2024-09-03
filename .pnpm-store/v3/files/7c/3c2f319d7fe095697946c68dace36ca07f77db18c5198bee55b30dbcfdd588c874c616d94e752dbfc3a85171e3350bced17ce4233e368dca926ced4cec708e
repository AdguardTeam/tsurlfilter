import { NetworkRule } from '../../../network-rule';

/**
 * Describes an error when a source network rule contains some of
 * the unsupported modifiers.
 *
 * @see {@link DeclarativeRuleConverter.checkNetworkRuleConvertible} for more details.
 */
export class UnsupportedModifierError extends Error {
    networkRule: NetworkRule;

    /**
     * Describes an error when a source network rule contains some of
     * the unsupported modifiers.
     *
     * @param message Message of error.
     * @param networkRule {@link NetworkRule}.
     */
    constructor(
        message: string,
        networkRule: NetworkRule,
    ) {
        super(message);

        this.name = 'UnsupportedModifierError';
        this.networkRule = networkRule;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnsupportedModifierError.prototype);
    }
}
