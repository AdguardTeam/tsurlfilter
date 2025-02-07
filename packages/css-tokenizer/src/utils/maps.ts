/**
 * @file Map utility functions
 */

/**
 * Simple utility function to merge two maps.
 *
 * @param map1 First map
 * @param map2 Second map
 *
 * @returns Merged map
 *
 * @note If a key is present in both maps, the value from the second map will be used
 * @note This function does not modify the original maps, it returns a new map
 */
export function mergeMaps<T, U>(map1: Map<T, U>, map2: Map<T, U>): Map<T, U> {
    const result = new Map<T, U>();

    for (const [key, value] of map1) {
        result.set(key, value);
    }

    for (const [key, value] of map2) {
        result.set(key, value);
    }

    return result;
}
