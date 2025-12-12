import { UNDERSCORE } from './constants';

/**
 * Validates the noop modifier (i.e. only underscores).
 *
 * @param value Value of the modifier.
 *
 * @returns True if the modifier is valid, false otherwise.
 */
export const isValidNoopModifier = (value: string): boolean => {
    const { length } = value;

    if (length === 0) {
        return false;
    }

    for (let i = 0; i < length; i += 1) {
        if (value[i] !== UNDERSCORE) {
            return false;
        }
    }

    return true;
};
