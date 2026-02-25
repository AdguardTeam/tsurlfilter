/**
 * @file Validator for pipe-separated domains.
 */

import { DomainListParser } from '../../parser/misc/domain-list-parser';
import { DomainUtils } from '../../utils/domain';
import { PIPE } from '../../utils/constants';
import { defaultParserOptions } from '../../parser/options';
import { RegExpUtils } from '../../utils';
import { type DomainList } from '../../nodes';
import { type ValidationContext, type Validator } from './types';

/**
 * Validates pipe_separated_domains format.
 * Used for $domain modifier.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validatePipeSeparatedDomains = (value: string, ctx: ValidationContext): void => {
    if (!value) {
        ctx.addError('EMPTY_DOMAIN_LIST');
        return;
    }

    let domainList: DomainList;
    try {
        domainList = DomainListParser.parse(value, defaultParserOptions, 0, PIPE);
    } catch (e: unknown) {
        if (e instanceof Error) {
            ctx.addError('DOMAIN_LIST_PARSE_ERROR', { message: e.message });
        } else {
            ctx.addError('DOMAIN_LIST_SYNTAX_ERROR');
        }
        return;
    }

    const invalidItems: string[] = [];
    for (let i = 0; i < domainList.children.length; i += 1) {
        const item = domainList.children[i];

        if (RegExpUtils.isRegexPattern(item.value)) {
            try {
                // Strip the leading and trailing slashes before constructing the RegExp
                new RegExp(item.value.slice(1, -1));
            } catch {
                invalidItems.push(item.value);
            }
        } else if (!DomainUtils.isValidDomainOrHostname(item.value)) {
            invalidItems.push(item.value);
        }
    }

    if (invalidItems.length > 0) {
        ctx.addError('INVALID_DOMAIN_LIST_VALUES', { values: invalidItems });
    }
};

/**
 * Pipe-separated domains validator.
 */
export const PipeSeparatedDomainsValidator: Validator = {
    name: 'pipe_separated_domains',
    validate: validatePipeSeparatedDomains,
};
