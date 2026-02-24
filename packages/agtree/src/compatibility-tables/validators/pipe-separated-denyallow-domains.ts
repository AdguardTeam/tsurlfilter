/**
 * @file Validator for pipe-separated domains.
 */

import { DomainListParser } from '../../parser/misc/domain-list-parser';
import { DomainUtils } from '../../utils/domain';
import { PIPE, WILDCARD } from '../../utils/constants';
import { defaultParserOptions } from '../../parser/options';
import { type DomainList } from '../../nodes';
import { type ValidationContext, type Validator } from './types';

/**
 * Validates pipe_separated_denyallow_domains format.
 * Used for $denyallow modifier. Does not allow wildcards or negation.
 *
 * @param value String value to validate.
 * @param ctx Validation context to collect issues into.
 */
const validatePipeSeparatedDenyAllowDomains = (value: string, ctx: ValidationContext): void => {
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

    const negatedItems: string[] = [];
    const invalidItems: string[] = [];

    for (let i = 0; i < domainList.children.length; i += 1) {
        const item = domainList.children[i];

        if (item.exception) {
            negatedItems.push(item.value);
            continue;
        }

        if (item.value.includes(WILDCARD) || !DomainUtils.isValidDomainOrHostname(item.value)) {
            invalidItems.push(item.value);
        }
    }

    if (negatedItems.length > 0) {
        ctx.addError('NEGATED_DOMAIN_VALUES', { values: negatedItems });
    }

    if (invalidItems.length > 0) {
        ctx.addError('INVALID_DOMAIN_LIST_VALUES', { values: invalidItems });
    }
};

/**
 * Pipe-separated denyallow domains validator.
 */
export const PipeSeparatedDenyAllowDomainsValidator: Validator = {
    name: 'pipe_separated_denyallow_domains',
    validate: validatePipeSeparatedDenyAllowDomains,
};
