/**
 * An error indicating that an operation timed out.
 */
export class TimeoutError extends Error {
    /**
     * Constructs a new TimeoutError.
     *
     * @param message Optional error message. Defaults to 'Operation timed out'.
     */
    constructor(message = 'Operation timed out') {
        super(message);
        this.name = 'TimeoutError';

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}
