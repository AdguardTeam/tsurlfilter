/**
 * @file Validator type declarations.
 */

import { type ValidationContext } from './validation-context';

export { ValidationContext, type ValidationIssue } from './validation-context';

/**
 * Validator function type.
 * Sub-validators mutate the provided context instead of returning a new result.
 */
export type ValidatorFn = (value: string, ctx: ValidationContext) => void;

/**
 * Validator object that pairs a name with its validation function.
 */
export interface Validator {
    name: string;
    validate: ValidatorFn;
}
