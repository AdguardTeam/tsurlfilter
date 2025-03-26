/**
 * @file Utility functions for working with domain lists
 */

import {
    type Modifier,
    type DomainList,
    ListNodeType,
    ListItemNodeType,
} from '../nodes';
import { DomainListParser } from '../parser/misc/domain-list-parser';
import { RegExpUtils } from '../utils/regexp';
import {
    COMMA_DOMAIN_LIST_SEPARATOR,
    PIPE_MODIFIER_SEPARATOR,
    ADG_DOMAINS_MODIFIER,
    ADG_URL_MODIFIER,
} from '../utils/constants';

/**
 * Creates a domain list based on the provided modifier and type.
 *
 * @param modifier - modifier containing the value to be parsed.
 * @param type - type of list to create, either 'domain' or 'url'.
 * @returns `DomainList` object if the modifier value is valid, otherwise `null`.
 *
 * If the type is 'domain', the function parses the modifier value using `DomainListParser`.
 * If the type is 'url', the function converts the modifier value to a regular expression.
 */
export function createDomainList(
    modifier: Modifier,
    type: typeof ADG_DOMAINS_MODIFIER | typeof ADG_URL_MODIFIER,
): DomainList | null {
    if (!modifier?.value?.value) {
        return null;
    }
    if (type === ADG_DOMAINS_MODIFIER) {
        return DomainListParser.parse(modifier.value.value, {}, modifier.start, PIPE_MODIFIER_SEPARATOR);
    }
    if (type === ADG_URL_MODIFIER) {
        const regexDomainValue = RegExpUtils.patternToRegexp(modifier.value.value);
        return {
            type: ListNodeType.DomainList,
            separator: COMMA_DOMAIN_LIST_SEPARATOR,
            children: [
                {
                    type: ListItemNodeType.Domain,
                    value: RegExpUtils.ensureSlashes(regexDomainValue),
                    exception: modifier?.exception ?? false,
                },
            ],
            start: modifier.start,
            end: modifier.end,
        };
    }
    return null;
}
