/* eslint-disable no-bitwise */

/**
 * @file Network rule utility functions for querying preparsed data.
 */

import {
    NR_FLAGS,
    NR_PATTERN_START,
    NR_PATTERN_END,
    NR_SEPARATOR_INDEX,
    FLAG_EXCEPTION,
    NO_VALUE,
} from '../types';
import { regionEquals } from './common';

/**
 * Returns `true` if the preparsed rule is an exception rule (`@@`).
 *
 * @param data Preparsed data buffer.
 * @returns Whether the rule is an exception.
 */
export function isException(data: Int32Array): boolean {
    return (data[NR_FLAGS] & FLAG_EXCEPTION) !== 0;
}

/**
 * Returns `true` if the preparsed rule has a modifier separator `$`.
 *
 * @param data Preparsed data buffer.
 * @returns Whether a separator was found.
 */
export function hasSeparator(data: Int32Array): boolean {
    return data[NR_SEPARATOR_INDEX] !== NO_VALUE;
}

/**
 * Returns the source index where the pattern starts.
 *
 * @param data Preparsed data buffer.
 * @returns Source start index.
 */
export function getPatternStartIndex(data: Int32Array): number {
    return data[NR_PATTERN_START];
}

/**
 * Returns the source index where the pattern ends (exclusive).
 *
 * @param data Preparsed data buffer.
 * @returns Source end index (exclusive).
 */
export function getPatternEndIndex(data: Int32Array): number {
    return data[NR_PATTERN_END];
}

/**
 * Returns the source index of the `$` separator, or -1 if none.
 *
 * @param data Preparsed data buffer.
 * @returns Separator source index or NO_VALUE.
 */
export function getSeparatorIndex(data: Int32Array): number {
    return data[NR_SEPARATOR_INDEX];
}

/**
 * Checks whether the pattern equals a given string, without allocation.
 *
 * @param source Original source string.
 * @param data Preparsed data buffer.
 * @param target String to compare against.
 * @returns `true` if the pattern matches the target exactly.
 */
export function patternEquals(source: string, data: Int32Array, target: string): boolean {
    return regionEquals(source, data[NR_PATTERN_START], data[NR_PATTERN_END], target);
}

/**
 * Extracts the pattern as a string from the source.
 *
 * @param source Original source string.
 * @param data Preparsed data buffer.
 * @returns Pattern substring.
 */
export function getPattern(source: string, data: Int32Array): string {
    return source.slice(data[NR_PATTERN_START], data[NR_PATTERN_END]);
}
