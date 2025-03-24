/**
 * @file Utility functions for working with domain lists
 */

import { type Modifier, type DomainList, ListNodeType } from '../nodes';
import { DomainListParser } from '../parser/misc/domain-list-parser';
import { RegExpUtils } from '../utils/regexp';
import { COMMA, PIPE } from '../utils/constants';

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
export function createDomainList(modifier: Modifier, type: 'domain' | 'url'): DomainList | null {
    if (!modifier?.value?.value) {
        return null;
    }
    if (type === 'domain') {
        return DomainListParser.parse(modifier.value.value, {}, modifier.start, PIPE);
    }
    if (type === 'url') {
        const regexDomainValue = RegExpUtils.patternToRegexp(modifier.value.value);
        return {
            type: ListNodeType.DomainList,
            separator: COMMA,
            children: [
                {
                    type: 'Domain',
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
