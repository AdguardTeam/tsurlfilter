/**
 * @file Customized error class for conversion errors.
 */

const ERROR_NAME = 'RuleConversionError';

/**
 * Customized error class for conversion errors.
 */
export class RuleConversionError extends Error {
    /**
     * Constructs a new `RuleConversionError` instance.
     *
     * @param message Error message
     */
    constructor(message: string) {
        super(message);

        this.name = ERROR_NAME;
    }
}
