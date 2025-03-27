/**
 * @file Utility functions for working with domain lists
 */

import {
    type DomainList,
    ListNodeType,
    ListItemNodeType,
    type DomainListSeparator,
} from '../nodes';
import { DomainListParser } from '../parser/misc/domain-list-parser';
import { RegExpUtils } from '../utils/regexp';
import { ADG_DOMAINS_MODIFIER, NEGATION_MARKER, ADG_URL_MODIFIER } from '../utils/constants';

/**
 * Helper function that parses a raw string of domains into an array of domain items.
 *
 * @param value - The raw domain string (e.g. "example.com|~test.com").
 * @param separator - The separator used in the string (e.g. "|" or ",").
 * @returns An array of { domain: domain, exception: exception } objects.
 */
export function parseDomains(value: string, separator: string) {
    return value
        .split(separator)
        .map((domain) => domain.trim())
        .filter(Boolean)
        .map((domain) => ({
            domain: domain.startsWith(NEGATION_MARKER) ? domain.slice(1) : domain,
            exception: domain.startsWith(NEGATION_MARKER),
        }));
}

/**
 * Creates a domain list from an array of domain objects.
 *
 * @param domains - Array of objects, each with a `domain` string and optional `exception` flag.
 * @param type - The type of list to create: either 'domain' or 'url'.
 * @param separator - The separator to use between domains.
 * @param start - The start position (e.g. from the modifier).
 * @param end - The end position.
 * @returns A DomainList object if the domains array is valid, otherwise null.
 */
export function createDomainList(
    domains: { domain: string, exception?: boolean }[],
    type: typeof ADG_DOMAINS_MODIFIER | typeof ADG_URL_MODIFIER,
    separator: DomainListSeparator,
    start: number | undefined,
    end: number | undefined,
): DomainList | null {
    if (!domains || domains.length === 0) {
        return null;
    }
    if (type === ADG_DOMAINS_MODIFIER) {
        // Convert each domain to its string representation. Exceptions are prefixed with "~".
        const domainStr = domains
            .map(({ domain, exception }) => (exception ? `${NEGATION_MARKER}${domain}` : domain))
            .join(separator);
        return DomainListParser.parse(domainStr, {}, start, separator);
    }
    if (type === ADG_URL_MODIFIER) {
        const children = domains.map(({ domain, exception }) => {
            const regexDomainValue = RegExpUtils.patternToRegexp(domain);
            return {
                type: ListItemNodeType.Domain,
                value: RegExpUtils.ensureSlashes(regexDomainValue),
                exception: exception ?? false,
            };
        });
        return {
            type: ListNodeType.DomainList,
            separator,
            children,
            start,
            end,
        };
    }
    return null;
}
