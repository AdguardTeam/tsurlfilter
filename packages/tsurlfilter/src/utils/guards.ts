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
