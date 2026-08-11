/**
 * @file Utility functions for comparing string arrays.
 */

/**
 * Checks whether two nullable string arrays are equal (same elements in same order).
 * Both `null` is considered equal.
 *
 * @param left First array or `null`.
 * @param right Second array or `null`.
 *
 * @returns `true` when both are `null` or both arrays have the same elements in the same order.
 */
export function stringArraysEqual(left: string[] | null, right: string[] | null): boolean {
    if (left === null && right === null) {
        return true;
    }
    if (left === null || right === null) {
        return false;
    }
    if (left.length !== right.length) {
        return false;
    }
    for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) {
            return false;
        }
    }
    return true;
}

/**
 * Checks whether two nullable string arrays share at least one element.
 * `null` on either side is treated as a wildcard (no filter applied), so the
 * function returns `true` whenever at least one side is `null`.
 *
 * This matches the tsurlfilter semantics used in `negatesBadfilter()`: a
 * `$badfilter` rule without a `$domain` modifier (`null`) should cancel a
 * target rule that has `$domain=x.com`, because the badfilter's domain list
 * is unrestricted.
 *
 * @param left First array or `null`.
 * @param right Second array or `null`.
 *
 * @returns `true` when either side is `null`, or at least one common element exists.
 */
export function stringArraysHaveIntersection(left: string[] | null, right: string[] | null): boolean {
    if (left === null || right === null) {
        return true;
    }
    return new Set(left).intersection(new Set(right)).size > 0;
}
