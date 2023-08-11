/**
 * @file Customized error class for not implemented features.
 */

const ERROR_NAME = 'NotImplementedError';
const BASE_MESSAGE = 'Not implemented';

/**
 * Customized error class for not implemented features.
 */
export class NotImplementedError extends Error {
    /**
     * Constructs a new `NotImplementedError` instance.
     *
     * @param message Additional error message (optional)
     */
    constructor(message: string | undefined = undefined) {
        // Prepare the full error message
        const fullMessage = message
            ? `${BASE_MESSAGE}: ${message}`
            : BASE_MESSAGE;

        super(fullMessage);

        this.name = ERROR_NAME;
    }
}
