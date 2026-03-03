/**
 * @file Common utility helpers shared across all preparser utils.
 */

/**
 * Compares a region of the source string with a target string
 * character by character, without creating any substrings.
 *
 * @param source Original source string.
 * @param start Start index in source (inclusive).
 * @param end End index in source (exclusive).
 * @param target String to compare against.
 * @returns `true` if the region matches the target exactly.
 */
export function regionEquals(source: string, start: number, end: number, target: string): boolean {
    const len = end - start;

    if (len !== target.length) {
        return false;
    }

    for (let i = 0; i < len; i += 1) {
        if (source.charCodeAt(start + i) !== target.charCodeAt(i)) {
            return false;
        }
    }

    return true;
}
