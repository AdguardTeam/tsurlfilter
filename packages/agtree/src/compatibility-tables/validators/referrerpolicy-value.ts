/**
 * @file Validator for referrerpolicy value.
 */

import { type ValidationContext, type Validator } from './types';

/**
 * Allowed directives for $referrerpolicy modifier.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy}
 */
export const REFERRER_POLICY_DIRECTIVES = new Set([
    'no-referrer',
    'no-referrer-when-downgrade',
    'origin',
    'origin-when-cross-origin',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url',
]);

/**
 * Validates referrerpolicy_value format.
 * Used for $referrerpolicy modifier.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validateReferrerPolicyValue = (value: string, ctx: ValidationContext): void => {
    if (!value) {
        ctx.addError('EMPTY_REFERRER_POLICY_VALUE');
        return;
    }

    if (!REFERRER_POLICY_DIRECTIVES.has(value)) {
        ctx.addError('INVALID_REFERRER_POLICY_DIRECTIVE', { value });
    }
};

/**
 * Referrer policy value validator.
 */
export const ReferrerPolicyValueValidator: Validator = {
    name: 'referrerpolicy_value',
    validate: validateReferrerPolicyValue,
};
