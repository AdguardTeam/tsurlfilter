/**
 * @file Clone related utilities
 *
 * We should keep clone related functions in this file. Thus, we just provide
 * a simple interface for cloning values, we use it across the AGTree project,
 * and the implementation "under the hood" can be improved later, if needed.
 */

import cloneDeep from 'clone-deep';

/**
 * Clones an input value to avoid side effects. Use it only in justified cases,
 * because it can impact performance negatively.
 *
 * @param value Value to clone
 * @returns Cloned value
 */
export function clone<T>(value: T): T {
    // TODO: Replace cloneDeep with a more efficient implementation
    return cloneDeep(value);
}
