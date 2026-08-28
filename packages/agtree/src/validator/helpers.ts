/**
 * @file Validation helpers for the old modifier validator API.
 *
 * Re-exports the canonical types from `compatibility-tables/validators/types`
 * and provides lightweight shim functions used by `validator/index.ts`.
 */

// Re-export canonical types so existing consumers keep working.
export { type ValidationIssue, ValidationContext } from '../compatibility-tables/validators/types';

/**
 * Simple plain-object result returned by the legacy modifier validator.
 *
 * New code should prefer `ValidationContext` which avoids
 * per-call object allocations.
 */
export type ValidationResult = {
    valid: boolean;
    error?: string;
    warn?: string;
};

/**
 * Returns invalid validation result with given error message.
 *
 * @param error Error message.
 *
 * @returns `{ valid: false, error }`.
 */
export const getInvalidValidationResult = (error: string): ValidationResult => {
    return { valid: false, error };
};

/**
 * Returns validation result with a warning.
 *
 * @param warn Warning message.
 *
 * @returns `{ valid: true, warn }`.
 */
export const getWarningValidationResult = (warn: string): ValidationResult => {
    return { valid: true, warn };
};

/**
 * Returns invalid validation result for value required error.
 *
 * @param modifierName Modifier name.
 *
 * @returns Validation result with VALUE_REQUIRED error.
 */
export const getValueRequiredValidationResult = (modifierName: string): ValidationResult => {
    return getInvalidValidationResult(`Value is required for the modifier: '${modifierName}'`);
};
