/**
 * @file Validator for pipe-separated stealth options.
 */

import { StealthOptionListParser } from '../../parser/misc/stealth-option-list-parser';
import { defaultParserOptions } from '../../parser/options';
import { type ValidationContext, type Validator } from './types';
import { type StealthOptionList } from '../../nodes';

/**
 * Allowed stealth options for $stealth modifier.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#stealth-modifier}
 */
export const ALLOWED_STEALTH_OPTIONS = new Set([
    'searchqueries',
    'donottrack',
    '3p-cookie',
    '1p-cookie',
    '3p-cache',
    '3p-auth',
    'webrtc',
    'push',
    'location',
    'flash',
    'java',
    'referrer',
    'useragent',
    'ip',
    'xclientdata',
    'dpi',
]);

/**
 * Validates pipe_separated_stealth_options format.
 * Used for $stealth modifier. Does not allow negation.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validatePipeSeparatedStealthOptions = (value: string, ctx: ValidationContext): void => {
    if (!value) {
        ctx.addError('EMPTY_STEALTH_OPTION_LIST');
        return;
    }

    let stealthOptionsList: StealthOptionList;
    try {
        stealthOptionsList = StealthOptionListParser.parse(value, defaultParserOptions, 0);
    } catch (e: unknown) {
        if (e instanceof Error) {
            ctx.addError('STEALTH_OPTION_LIST_PARSE_ERROR', { message: e.message });
        } else {
            ctx.addError('STEALTH_OPTION_LIST_SYNTAX_ERROR');
        }
        return;
    }

    const negatedItems: string[] = [];
    const invalidItems: string[] = [];

    for (let i = 0; i < stealthOptionsList.children.length; i += 1) {
        const item = stealthOptionsList.children[i];
        if (item.exception) {
            negatedItems.push(item.value);
        }
        if (!ALLOWED_STEALTH_OPTIONS.has(item.value)) {
            invalidItems.push(item.value);
        }
    }

    if (negatedItems.length > 0) {
        ctx.addError('NEGATED_STEALTH_OPTION_VALUES', { values: negatedItems });
    }

    if (invalidItems.length > 0) {
        ctx.addError('INVALID_STEALTH_OPTION_LIST_VALUES', { values: invalidItems });
    }
};

/**
 * Pipe-separated stealth options validator.
 */
export const PipeSeparatedStealthOptionsValidator: Validator = {
    name: 'pipe_separated_stealth_options',
    validate: validatePipeSeparatedStealthOptions,
};
