/**
 * @file Customized error for binary schema mismatch.
 */

const ERROR_NAME = 'BinarySchemaMismatchError';

/**
 * Customized error for binary schema mismatch.
 */
export class BinarySchemaMismatchError extends Error {
    /**
     * Expected schema version.
     */
    expectedVersion: number;

    /**
     * Actual schema version.
     */
    actualVersion: number;

    /**
     * Constructs a new `BinarySchemaMismatchError` instance.
     *
     * @param expectedVersion Expected schema version.
     * @param actualVersion Actual schema version.
     */
    constructor(expectedVersion: number, actualVersion: number) {
        super(`Expected schema version ${expectedVersion}, but got ${actualVersion}`);

        this.name = ERROR_NAME;
        this.expectedVersion = expectedVersion;
        this.actualVersion = actualVersion;
    }
}
