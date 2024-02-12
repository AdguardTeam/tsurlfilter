/**
 * Checks whether the given value is undefined.
 *
 * @param value Value to check.
 *
 * @returns True if the value type is not 'undefined'.
 */
export const isUndefined = (value: unknown): value is undefined => {
    return typeof value === 'undefined';
};

/**
 * Checks whether the given value is an array of Uint8Arrays.
 *
 * @param value Value to check.
 *
 * @returns True if the value type is an array of Uint8Arrays.
 */
export const isArrayOfUint8Arrays = (value: unknown): value is Uint8Array[] => {
    if (!Array.isArray(value)) {
        return false;
    }

    for (const chunk of value) {
        if (!(chunk instanceof Uint8Array)) {
            return false;
        }
    }

    return true;
};
