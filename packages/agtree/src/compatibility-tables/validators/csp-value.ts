/**
 * @file Validator for CSP value.
 */

import { SEMICOLON, SPACE } from '../../utils/constants';
import { QuoteUtils } from '../../utils/quotes';
import { type ValidationContext, type Validator } from './types';

/**
 * Allowed CSP directives for $csp modifier.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy#directives}
 */
const ALLOWED_CSP_DIRECTIVES = new Set([
    'base-uri',
    'child-src',
    'connect-src',
    'default-src',
    'fenced-frame-src',
    'font-src',
    'form-action',
    'frame-ancestors',
    'frame-src',
    'img-src',
    'manifest-src',
    'media-src',
    'navigate-to',
    'object-src',
    'plugin-types',
    'prefetch-src',
    'referrer',
    'report-to',
    'report-uri',
    'require-trusted-types-for',
    'sandbox',
    'script-src',
    'script-src-attr',
    'script-src-elem',
    'style-src',
    'style-src-attr',
    'style-src-elem',
    'trusted-types',
    'upgrade-insecure-requests',
    'worker-src',
]);

/**
 * Validates csp_value format.
 * Used for $csp modifier.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validateCspValue = (value: string, ctx: ValidationContext): void => {
    if (!value) {
        ctx.addError('EMPTY_CSP_VALUE');
        return;
    }

    // Manually iterate through the value to find directives separated by semicolons
    let currentPos = 0;
    let foundDirective = false;
    const invalidDirectives: string[] = [];

    while (currentPos < value.length) {
        // Find the next semicolon or end of string
        let semicolonPos = value.indexOf(SEMICOLON, currentPos);
        if (semicolonPos === -1) {
            semicolonPos = value.length;
        }

        // Extract the directive
        const policyDirective = value.slice(currentPos, semicolonPos).trim();

        if (policyDirective) {
            foundDirective = true;

            // Find the first space to separate directive name from value
            const spacePos = policyDirective.indexOf(SPACE);
            const directive = spacePos === -1 ? policyDirective : policyDirective.slice(0, spacePos);
            const directiveValue = spacePos === -1 ? '' : policyDirective.slice(spacePos + 1).trim();

            if (!directive) {
                ctx.addError('EMPTY_CSP_DIRECTIVE');
                return;
            }

            // Check if directive is quoted
            if (!ALLOWED_CSP_DIRECTIVES.has(directive)) {
                const unquotedDirective = QuoteUtils.removeQuotes(directive);
                if (ALLOWED_CSP_DIRECTIVES.has(unquotedDirective)) {
                    ctx.addError('CSP_DIRECTIVE_QUOTED', { directive: unquotedDirective });
                    return;
                }
                invalidDirectives.push(directive);
            } else if (!directiveValue) {
                // Directive must have a value
                ctx.addError('CSP_DIRECTIVE_NO_VALUE', { directive });
                return;
            }
        } else if (foundDirective) {
            // Empty segment between semicolons after a valid directive
            ctx.addError('EMPTY_CSP_DIRECTIVE');
            return;
        }

        // Move to the next directive (after semicolon)
        currentPos = semicolonPos + 1;
    }

    if (invalidDirectives.length > 0) {
        ctx.addError('INVALID_CSP_DIRECTIVES', { directives: invalidDirectives });
        return;
    }

    if (!foundDirective) {
        ctx.addError('NO_CSP_DIRECTIVES');
    }
};

/**
 * CSP value validator.
 */
export const CspValueValidator: Validator = {
    name: 'csp_value',
    validate: validateCspValue,
};
