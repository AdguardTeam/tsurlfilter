/**
 * @file Validator for regular expression values.
 */

import { RegExpUtils } from '../../utils';
import { type ValidationContext, type Validator } from './types';

/**
 * Validates that the value is a valid regular expression.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validateRegexp = (value: string, ctx: ValidationContext): void => {
    if (!value) {
        ctx.addError('EMPTY_REGEXP');
        return;
    }

    try {
        if (RegExpUtils.isRegexPattern(value)) {
            new RegExp(value.slice(1, -1));
        } else {
            new RegExp(value);
        }
    } catch (e) {
        ctx.addError('INVALID_REGEXP');
    }
};

/**
 * Regexp validator.
 */
export const RegexpValidator: Validator = {
    name: 'regexp',
    validate: validateRegexp,
};
