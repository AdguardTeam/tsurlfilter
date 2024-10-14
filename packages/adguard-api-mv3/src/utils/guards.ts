/**
 * Checks if the given value is an object.
 *
 * @param value The value to check.
 *
 * @returns True if the value is an object and not null, otherwise false.
 */
export const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};
