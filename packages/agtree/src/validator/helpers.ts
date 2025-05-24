import { UNDERSCORE } from '../utils/constants.js';
import { VALIDATION_ERROR_PREFIX } from './constants.js';

/**
 * Result of modifier validation:
 * - `{ valid: true }` for valid and _fully supported_ modifier;
 * - `{ valid: true, warn: <deprecation notice> }` for valid
 *   and _still supported but deprecated_ modifier;
 * - otherwise `{ valid: true, error: <invalidity reason> }`
 */
export type ValidationResult = {
    valid: boolean,
    error?: string,
    warn?: string,
};

/**
 * Validates the noop modifier (i.e. only underscores).
 *
 * @param value Value of the modifier.
 *
 * @returns True if the modifier is valid, false otherwise.
 */
export const isValidNoopModifier = (value: string): boolean => {
    return value.split('').every((char) => char === UNDERSCORE);
};

/**
 * Returns invalid validation result with given error message.
 *
 * @param error Error message.
 *
 * @returns Validation result `{ valid: false, error }`.
 */
export const getInvalidValidationResult = (error: string): ValidationResult => {
    return {
        valid: false,
        error,
    };
};

/**
 * Returns invalid validation result which uses {@link VALIDATION_ERROR_PREFIX.VALUE_REQUIRED} as prefix
 * and specifies the given `modifierName` in the error message.
 *
 * @param modifierName Modifier name.
 *
 * @returns Validation result `{ valid: false, error }`.
 */
export const getValueRequiredValidationResult = (modifierName: string): ValidationResult => {
    return getInvalidValidationResult(`${VALIDATION_ERROR_PREFIX.VALUE_REQUIRED}: '${modifierName}'`);
};
