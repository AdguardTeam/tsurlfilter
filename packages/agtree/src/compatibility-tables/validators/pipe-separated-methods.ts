/**
 * @file Validator for pipe-separated HTTP methods.
 */

import { MethodListParser } from '../../parser/misc/method-list-parser';
import { defaultParserOptions } from '../../parser/options';
import { type ValidationContext, type Validator } from './types';
import { type MethodList } from '../../nodes';

/**
 * Allowed methods for $method modifier.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#method-modifier}
 */
export const ALLOWED_METHODS = new Set([
    'connect',
    'delete',
    'get',
    'head',
    'options',
    'patch',
    'post',
    'put',
    'trace',
]);

/**
 * Validates pipe_separated_methods format.
 * Used for $method modifier. All methods must be consistently negated or not negated.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validatePipeSeparatedMethods = (value: string, ctx: ValidationContext): void => {
    if (!value) {
        ctx.addError('EMPTY_METHOD_LIST');
        return;
    }

    let methodList: MethodList;
    try {
        methodList = MethodListParser.parse(value, defaultParserOptions, 0);
    } catch (e: unknown) {
        if (e instanceof Error) {
            ctx.addError('METHOD_LIST_PARSE_ERROR', { message: e.message });
        } else {
            ctx.addError('METHOD_LIST_SYNTAX_ERROR');
        }
        return;
    }

    const firstException = methodList.children[0].exception;
    const invalidItems: string[] = [];
    const inconsistentItems: string[] = [];

    for (const method of methodList.children) {
        if (!ALLOWED_METHODS.has(method.value)) {
            invalidItems.push(method.value);
        }

        if (method.exception !== firstException) {
            inconsistentItems.push(method.value);
        }
    }

    if (invalidItems.length > 0) {
        ctx.addError('INVALID_METHOD_LIST_VALUES', { values: invalidItems });
    }

    if (inconsistentItems.length > 0) {
        ctx.addError('MIXED_METHOD_NEGATIONS', { values: inconsistentItems });
    }
};

/**
 * Pipe-separated methods validator.
 */
export const PipeSeparatedMethodsValidator: Validator = {
    name: 'pipe_separated_methods',
    validate: validatePipeSeparatedMethods,
};
