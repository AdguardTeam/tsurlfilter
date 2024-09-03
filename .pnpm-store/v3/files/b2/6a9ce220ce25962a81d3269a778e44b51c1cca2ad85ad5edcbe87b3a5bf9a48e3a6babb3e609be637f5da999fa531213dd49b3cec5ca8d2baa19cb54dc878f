const ERROR_NAME = 'UnacceptableResponseError';

/**
 * Customized error class for unacceptable responses for patch requests.
 */
export class UnacceptableResponseError extends Error {
    /**
     * Constructs a new `UnacceptableResponseError` instance.
     *
     * @param message Error message.
     */
    constructor(message: string) {
        super(message);

        this.name = ERROR_NAME;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnacceptableResponseError.prototype);
    }
}
