/**
 * Describes error when the resources path does not start with a slash
 * or it ends with a slash.
 */
export class ResourcesPathError extends Error {
    /**
     * Describes error when the resources path does not start with a slash
     * or it ends with a slash.
     *
     * @param message Message of error.
     */
    constructor(message: string) {
        super(message);

        this.name = 'ResourcesPathError';

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, ResourcesPathError.prototype);
    }
}
