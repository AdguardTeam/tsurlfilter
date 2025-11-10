import { type NetworkRule } from '../../network-rule';

/**
 * Describes an error when a source network rule contains some of the unsupported modifiers.
 */
export class UnsupportedModifierError extends Error {
    /**
     * {@link NetworkRule} related to this error.
     */
    public networkRule: NetworkRule;

    /**
     * Describes an error when a source network rule contains some of the unsupported modifiers.
     *
     * @param message Message of error.
     * @param networkRule {@link NetworkRule}.
     */
    constructor(
        message: string,
        networkRule: NetworkRule,
    ) {
        super(message);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnsupportedModifierError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;

        this.networkRule = networkRule;
    }
}
