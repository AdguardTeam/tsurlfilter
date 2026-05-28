/**
 * @file Validator type declarations.
 */

import { type Platform } from '../platform';

import { type ValidationContext } from './validation-context';

export { ValidationContext, type ValidationIssue } from './validation-context';

/**
 * Validator function type.
 * Sub-validators mutate the provided context instead of returning a new result.
 *
 * @param value The string value to validate.
 * @param ctx Validation context to collect issues into.
 * @param platform Optional platform for platform-aware validators (e.g. redirect_resource).
 */
export type ValidatorFn = (value: string, ctx: ValidationContext, platform?: Platform) => void;

/**
 * Validator object that pairs a name with its validation function.
 */
export interface Validator {
    name: string;
    validate: ValidatorFn;
}
