/**
 * Describes error when the resources path does not start with a slash or it ends with a slash.
 */
export class ResourcesPathError extends Error {
    /**
     * Describes error when the resources path does not start with a slash or it ends with a slash.
     *
     * @param message Message of error.
     */
    constructor(message: string) {
        super(message);

        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, ResourcesPathError.prototype);

        // Set the error name to the class name only after setting the prototype
        // to avoid issues with name being overwritten in some environments
        this.name = this.constructor.name;
    }
}
