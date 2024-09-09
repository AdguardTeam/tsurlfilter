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
 * Checks whether the given value is a number.
 *
 * @param value Value to check.
 *
 * @returns `true` if the value is a number, `false` otherwise.
 */
export const isNumber = (value: unknown): value is number => {
    return typeof value === 'number' && !Number.isNaN(value);
};

/**
 * Checks whether the given value is an integer.
 *
 * @param value Value to check.
 *
 * @returns `true` if the value is an integer, `false` otherwise.
 */
export const isInteger = (value: unknown): value is number => {
    return Number.isInteger(value);
};

/**
 * Checks whether the given value is a string.
 *
 * @param value Value to check.
 * @returns `true` if the value is a string, `false` otherwise.
 */
export const isString = (value: unknown): value is string => {
    return typeof value === 'string';
};

/**
 * Checks whether the given value is an array of Uint8Arrays.
 *
 * @param value Value to check.
 *
 * @returns True if the value type is an array of Uint8Arrays.
 */
export const isArrayOfUint8Arrays = (value: unknown): value is Uint8Array[] => {
    return Array.isArray(value) && value.every((chunk) => chunk instanceof Uint8Array);
};
