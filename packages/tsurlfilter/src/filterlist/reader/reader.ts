import { type AnyRule } from '@adguard/agtree';

/**
 * Reader interface.
 */
export interface IReader<T = AnyRule> {
    /**
     * Reads the next element from the data.
     *
     * @return line string or null.
     */
    readNext(): T | null;

    /**
     * Returns the current position of this reader.
     */
    getCurrentPos(): number;

    /**
     * Returns the length of the data.
     */
    getDataLength(): number;
}
