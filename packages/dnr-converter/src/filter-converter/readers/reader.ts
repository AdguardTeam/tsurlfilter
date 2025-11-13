import { type AnyRule } from '@adguard/agtree';

/**
 * Reader interface.
 */
export interface IReader<T = AnyRule> {
    /**
     * Reads the next element from the data.
     *
     * @returns Line string or null.
     */
    readNext(): T | null;

    /**
     * Retrieves the current position of this reader or -1 if there's nothing to read.
     *
     * @returns The current position or -1 if there's nothing to read.
     */
    getCurrentPos(): number;

    /**
     * Retrieves the length of the data.
     *
     * @returns The length of the data.
     */
    getDataLength(): number;
}
