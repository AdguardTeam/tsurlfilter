/**
 * @file Modifier list utility functions for querying preparsed data.
 */

import { NR_MODIFIER_COUNT } from '../types';
import { modifierNameEquals } from './modifier';

/**
 * Returns the number of modifiers in the preparsed rule.
 *
 * @param data Preparsed data buffer.
 * @returns Modifier count.
 */
export function getModifierCount(data: Int32Array): number {
    return data[NR_MODIFIER_COUNT];
}

/**
 * Searches for a modifier by name (zero allocation).
 * Returns the modifier index if found, or -1 if not.
 *
 * @param source Original source string.
 * @param data Preparsed data buffer.
 * @param name Modifier name to search for.
 * @returns Modifier index (0-based) or -1.
 */
export function findModifierIndex(source: string, data: Int32Array, name: string): number {
    const count = data[NR_MODIFIER_COUNT];

    for (let i = 0; i < count; i += 1) {
        if (modifierNameEquals(source, data, i, name)) {
            return i;
        }
    }

    return -1;
}

/**
 * Returns `true` if the rule has a modifier with the given name.
 * Zero allocation.
 *
 * @param source Original source string.
 * @param data Preparsed data buffer.
 * @param name Modifier name to search for.
 * @returns `true` if found.
 */
export function hasModifierNamed(source: string, data: Int32Array, name: string): boolean {
    return findModifierIndex(source, data, name) !== -1;
}
