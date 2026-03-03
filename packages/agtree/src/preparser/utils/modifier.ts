/* eslint-disable no-bitwise */

/**
 * @file Single modifier utility functions for querying preparsed data.
 */

import {
    NR_HEADER_SIZE,
    MOD_STRIDE,
    MOD_NAME_START,
    MOD_NAME_END,
    MOD_FLAGS,
    MOD_VALUE_START,
    MOD_VALUE_END,
    MOD_FLAG_NEGATED,
    NO_VALUE,
} from '../types';
import { regionEquals } from './common';

/**
 * Returns `true` if the modifier at `idx` is negated (`~`).
 *
 * @param data Preparsed data buffer.
 * @param idx Modifier index (0-based).
 * @returns Whether the modifier is negated.
 */
export function isModifierNegated(data: Int32Array, idx: number): boolean {
    const base = NR_HEADER_SIZE + idx * MOD_STRIDE;
    return (data[base + MOD_FLAGS] & MOD_FLAG_NEGATED) !== 0;
}

/**
 * Returns `true` if the modifier at `idx` has a value (i.e. `name=value`).
 *
 * @param data Preparsed data buffer.
 * @param idx Modifier index (0-based).
 * @returns Whether the modifier has a value.
 */
export function hasModifierValue(data: Int32Array, idx: number): boolean {
    const base = NR_HEADER_SIZE + idx * MOD_STRIDE;
    return data[base + MOD_VALUE_START] !== NO_VALUE;
}

/**
 * Checks whether the modifier name at `idx` equals a given string,
 * without allocation.
 *
 * @param source Original source string.
 * @param data Preparsed data buffer.
 * @param idx Modifier index (0-based).
 * @param name Name string to compare against.
 * @returns `true` if the modifier name matches.
 */
export function modifierNameEquals(
    source: string,
    data: Int32Array,
    idx: number,
    name: string,
): boolean {
    const base = NR_HEADER_SIZE + idx * MOD_STRIDE;
    return regionEquals(source, data[base + MOD_NAME_START], data[base + MOD_NAME_END], name);
}

/**
 * Extracts the modifier name at `idx` as a string.
 *
 * @param source Original source string.
 * @param data Preparsed data buffer.
 * @param idx Modifier index (0-based).
 * @returns Modifier name substring.
 */
export function getModifierName(source: string, data: Int32Array, idx: number): string {
    const base = NR_HEADER_SIZE + idx * MOD_STRIDE;
    return source.slice(data[base + MOD_NAME_START], data[base + MOD_NAME_END]);
}

/**
 * Extracts the modifier value at `idx` as a string, or `null` if no value.
 *
 * @param source Original source string.
 * @param data Preparsed data buffer.
 * @param idx Modifier index (0-based).
 * @returns Modifier value substring or `null`.
 */
export function getModifierValue(source: string, data: Int32Array, idx: number): string | null {
    const base = NR_HEADER_SIZE + idx * MOD_STRIDE;
    const vs = data[base + MOD_VALUE_START];

    if (vs === NO_VALUE) {
        return null;
    }

    return source.slice(vs, data[base + MOD_VALUE_END]);
}

/**
 * Returns the name and value bounds for the modifier at `idx`
 * as source indices (zero allocation, no strings).
 *
 * @param data Preparsed data buffer.
 * @param idx Modifier index (0-based).
 * @returns Object with nameStart, nameEnd, valueStart, valueEnd.
 */
export function getModifierBounds(
    data: Int32Array,
    idx: number,
): { nameStart: number; nameEnd: number; valueStart: number; valueEnd: number } {
    const base = NR_HEADER_SIZE + idx * MOD_STRIDE;
    return {
        nameStart: data[base + MOD_NAME_START],
        nameEnd: data[base + MOD_NAME_END],
        valueStart: data[base + MOD_VALUE_START],
        valueEnd: data[base + MOD_VALUE_END],
    };
}
