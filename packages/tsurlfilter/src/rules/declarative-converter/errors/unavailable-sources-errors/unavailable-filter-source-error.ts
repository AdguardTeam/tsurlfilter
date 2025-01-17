/**
 * Describes an error when filter source is not available.
 */
export class UnavailableFilterSourceError extends Error {
    filterId: number;

    /**
     * Describes an error when filter source is not available.
     *
     * @param message Message of error.
     * @param filterId Filter id, the source of which is not available.
     * @param cause Basic error, describes why the source is unavailable.
     */
    constructor(
        message: string,
        filterId: number,
        cause?: Error,
    ) {
        super(message, { cause });

        this.name = this.constructor.name;
        this.filterId = filterId;

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnavailableFilterSourceError.prototype);
    }
}
