import { NetworkRule } from '../../../network-rule';

/**
 * Describes an error when a source network rule contains some of
 * the unsupported modifiers.
 */
export class UnsupportedModifierError extends Error {
    networkRule: NetworkRule;

    /**
     * Describes an error when a source network rule contains some of
     * the unsupported modifiers.
     * We skip the following modifiers:
     * $removeparam - if it contains a negation, or regexp,
     * or the rule is a allowlist
     * $elemhide
     * $jsinject
     * $cookie
     * $csp
     * $replace
     * $generichide
     * $stealth
     * $mp4.
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
