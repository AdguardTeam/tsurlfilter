/**
 * @file Node utils for testing.
 */

import { type LocationRange, defaultLocation } from '../../src/parser/common';
import { locRange } from '../../src/utils/location';

/**
 * Finds the start and end indices of a substring occurrence in a string.
 *
 * @param string The input string to search within.
 * @param substring - The substring to find.
 * @param occurrence - The occurrence of the substring to locate. Positive values start searching from the beginning,
 * negative values start searching from the end. Must be a non-zero number.
 * @returns A tuple containing the start and end indices of the substring occurrence.
 * @throws Throws an error if the occurrence is not found or if occurrence is 0.
 * @example
 * ```ts
 * getRanges('abcabcabc', 'abc', 1); // [0, 3]
 * getRanges('abcabcabc', 'abc', 2); // [3, 6]
 * getRanges('abcabcabc', 'abc', 3); // [6, 9]
 * getRanges('abcabcabc', 'abc', -1); // [6, 9]
 * getRanges('abcabcabc', 'abc', -2); // [3, 6]
 * getRanges('abcabcabc', 'abc', -3); // [0, 3]
 * getRanges('abcabcabc', 'abc', 4); // Error: Substring not found for occurrence 4
 * getRanges('abcabcabc', 'abc', -4); // Error: Substring not found for occurrence -4
 * getRanges('abcabcabc', 'abc', 0); // Error: Invalid occurrence value. Occurrence must be a non-zero number.
 * ```
 */
export function getRanges(string: string, substring: string, occurrence: number): [number, number] {
    if (occurrence === 0) {
        throw new Error('Invalid occurrence value. Occurrence must be a non-zero number.');
    }

    let index: number;

    if (occurrence > 0) {
        index = string.indexOf(substring);
        for (let i = 1; i < occurrence && index !== -1; i += 1) {
            index = string.indexOf(substring, index + 1);
        }
    } else {
        index = string.lastIndexOf(substring);
        for (let i = -1; i > occurrence && index !== -1; i -= 1) {
            index = string.lastIndexOf(substring, index - 1);
        }
    }

    if (index === -1) {
        throw new Error(`Substring '${substring}' not found for occurrence '${occurrence}'`);
    }

    return [index, index + substring.length];
}

/**
 * Context for the {@link NodeExpectFn}.
 */
export class NodeExpectContext {
    /**
     * Actual string that test is run on.
     */
    public readonly actual: string;

    /**
     * Creates a new instance of NodeExpectContext.
     *
     * @param actual Actual string that test is run on.
     */
    public constructor(actual: string) {
        this.actual = actual;
    }

    /**
     * Gets the full location range for the whole actual string.
     *
     * @returns Location range. See {@link LocationRange}.
     */
    public getFullLocRange(): LocationRange {
        return locRange(defaultLocation, 0, this.actual.length);
    }

    /**
     * Gets the location range for the given substring.
     *
     * Perhaps that the searched substring appears more than once in the actual string. In this case, you can specify
     * the index of the occurrence to get the location range for. By default, the first occurrence is used.
     *
     * @param substring Substring to get the location range for.
     * @param occurrence 1-based occurrence of the substring to get the location range for. Defaults to 1
     * (first occurrence). If you want to get the last occurrence, you can pass -1, or if you want to get the
     * second last occurrence, you can pass -2, etc.
     * @returns Location range. See {@link LocationRange}.
     * @throws Throws an error if the occurrence is not found or if occurrence is 0.
     */
    public getLocRangeFor(substring: string, occurrence = 1): LocationRange {
        return locRange(defaultLocation, ...getRanges(this.actual, substring, occurrence));
    }

    /**
     * Gets the location range between two substrings.
     *
     * @param substring1 The first substring.
     * @param substring2 The second substring.
     * @returns Location range. See {@link LocationRange}.
     */
    public getLocRangeBetween(substring1: string, substring2: string): LocationRange {
        const idx1 = this.actual.indexOf(substring1);
        const idx2 = this.actual.indexOf(substring2);
        if (idx1 === -1) {
            throw new Error(`Substring '${substring1}' not found`);
        }
        if (idx2 === -1) {
            throw new Error(`Substring '${substring2}' not found`);
        }
        return locRange(defaultLocation, idx1 + substring1.length, idx2);
    }
}

/**
 * Function that returns the expected node.
 */
export type NodeExpectFn<T> = (context: NodeExpectContext) => T;
