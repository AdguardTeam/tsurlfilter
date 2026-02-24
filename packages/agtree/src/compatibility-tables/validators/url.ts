/**
 * @file Validator for URL values.
 */

import { type ValidationContext, type Validator } from './types';

/**
 * Validates that the value is a valid URL.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validateUrl = (value: string, ctx: ValidationContext): void => {
    if (!value) {
        ctx.addError('EMPTY_URL');
        return;
    }

    try {
        new URL(value);
    } catch (e) {
        ctx.addError('INVALID_URL');
    }
};

/**
 * URL validator.
 */
export const UrlValidator: Validator = {
    name: 'url',
    validate: validateUrl,
};
