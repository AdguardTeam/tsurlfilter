/**
 * @file Various type guards.
 */

/**
 * Checks whether the given value is undefined.
 *
 * @param value Value to check.
 *
 * @returns `true` if the value is 'undefined', `false` otherwise.
 */
export const isUndefined = (value: unknown): value is undefined => {
    return typeof value === 'undefined';
};

/**
 * Checks whether the given value is null.
 *
 * @param value Value to check.
 *
 * @returns `true` if the value is 'null', `false` otherwise.
 */
export const isNull = (value: unknown): value is null => {
    return value === null;
};

/**
 * Checks whether the given value is an array.
 *
 * @param value Value to check.
 *
 * @returns `true` if the value is an array, `false` otherwise.
 */
export const isArray = <T>(value: unknown): value is T[] => {
    return Array.isArray(value);
};

/**
 * Checks whether the given value is a non-empty array.
 *
 * @param value Value to check.
 *
 * @returns `true` if the value is a non-empty array, `false` otherwise.
 */
export const isNonEmptyArray = <T>(value: unknown): value is T[] => {
    return isArray(value) && value.length > 0;
};
