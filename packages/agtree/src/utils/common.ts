/**
 * Checks whether the given value is defined.
 * @param value
 *
 * @returns True if the value type is not 'undefined'.
 */
export const isUndefined = (value: unknown): value is undefined => {
    return typeof value === 'undefined';
};
