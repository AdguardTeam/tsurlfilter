import { type NetworkRule, NetworkRuleType, RuleCategory } from '@adguard/agtree';
import { AdblockSyntax } from '@adguard/agtree/utils';

import { replaceAll } from '../utils/string-utils';

import { SimpleRegex } from './simple-regex';

/**
 * Schemes of the URLs the engine creates requests for.
 */
const REQUEST_SCHEME = 'https?|wss?';

/**
 * Credentials of the URL authority, ending at its last `@`. The slashes are escaped so the
 * generated rule stays splittable on an unescaped `/`.
 */
const AUTHORITY_CREDENTIALS = String.raw`[^\/\\?#]*@`;

/**
 * Start of the URL up to the host.
 */
const URL_START = `^(?:${REQUEST_SCHEME}):\\/\\/(?:${AUTHORITY_CREDENTIALS})?`;

/**
 * Optional `www.` subdomain of the entry.
 */
const WWW_PREFIX = String.raw`(www\.)?`;

/**
 * Optional dot of the root label, grouped to keep the pattern shortcut intact.
 */
const ROOT_LABEL_DOT = String.raw`(?:\.)?`;

/**
 * Optional port, digits only.
 */
const PORT = String.raw`(?::\d*)?`;

/**
 * Everything that ends the host: path, query, fragment, backslash or the end of the URL.
 */
const HOST_BOUNDARY = String.raw`(?:[\/\\?#]|$)`;

/**
 * Wildcard of an entry: any characters of the host, but never the authority delimiters, so a
 * `*` cannot move the match to another host or into the path.
 */
const HOST_WILDCARD = String.raw`[^\/\\?#@]*`;

/**
 * Subdomains before the entry domain, each ending with a dot. The character class excludes dots
 * and the authority delimiters, so the labels stay separate and cannot reach another host.
 */
const SUBDOMAIN_LABELS = String.raw`(?:[^\/\\?#@.]+\.)*`;

/**
 * Checks whether the entry covers the domain together with all its subdomains.
 *
 * @param domain Normalized allowlist entry.
 *
 * @returns True for the `*.domain` form.
 */
const isSubdomainEntry = (domain: string): boolean => domain.startsWith('*.');

/**
 * Checks whether the entry has a label to match, i.e. a character that is neither a wildcard
 * nor a dot. An entry like `*` or `**` describes no host at all and is ignored: the allowlist
 * editor rejects it as an invalid no-op, and the full wildcard is only supported as `*.*`.
 *
 * @param domain Normalized allowlist entry.
 *
 * @returns True if the entry contains at least one literal character.
 */
const hasConcreteLabel = (domain: string): boolean => /[^*.]/.test(domain);

/**
 * Checks whether the entry is the full wildcard, e.g. the `*` of `*.*`.
 *
 * @param domain Normalized allowlist entry.
 *
 * @returns True if the entry consists of wildcards only.
 */
const isFullWildcard = (domain: string): boolean => /^\*+$/.test(domain);

/**
 * Removes the `www.` prefix, which the generated rule matches anyway.
 *
 * @param domain Normalized allowlist entry.
 *
 * @returns Entry without the `www.` prefix.
 */
const stripWwwPrefix = (domain: string): string => (
    domain.startsWith('www.') ? domain.substring(4) : domain
);

/**
 * Escapes the regexp special characters of the entry and turns `*` back into a host wildcard.
 *
 * @param domain Normalized allowlist entry.
 *
 * @returns Domain as a regexp fragment.
 */
const escapeDomainForRegexp = (domain: string): string => {
    const escapedDomain = replaceAll(SimpleRegex.escapeRegexSpecials(domain), '/', '\\/');

    return replaceAll(escapedDomain, '\\*', HOST_WILDCARD);
};

/**
 * Builds a pattern that covers the domain together with all its subdomains. Both the subdomains
 * and the domain itself are anchored to the URL host, so a wildcard in the entry cannot move the
 * match to another host. The full wildcard `*.*` keeps covering every URL.
 *
 * @param baseDomain Domain without the `*.` prefix.
 *
 * @returns Pattern of the allowlist rule.
 */
const createSubdomainPattern = (baseDomain: string): string => {
    if (isFullWildcard(baseDomain)) {
        return `${SimpleRegex.MASK_START_URL}*${SimpleRegex.MASK_SEPARATOR}`;
    }

    const escapedBaseDomain = escapeDomainForRegexp(baseDomain);

    return `/${URL_START}${SUBDOMAIN_LABELS}${escapedBaseDomain}${ROOT_LABEL_DOT}${PORT}${HOST_BOUNDARY}/`;
};

/**
 * Builds a pattern that covers the host itself and its `www.` variant.
 *
 * @param domain Domain without the `www.` prefix.
 *
 * @returns Pattern of the allowlist rule.
 */
const createExactHostPattern = (domain: string): string => {
    const escapedDomain = escapeDomainForRegexp(domain);

    return `/${URL_START}${WWW_PREFIX}${escapedDomain}${ROOT_LABEL_DOT}${PORT}${HOST_BOUNDARY}/`;
};

/**
 * Builds the rule pattern for the entry.
 *
 * @param domain Normalized allowlist entry.
 *
 * @returns Pattern of the allowlist rule, or null if the entry has no domain.
 */
const createDomainPattern = (domain: string): null | string => {
    if (!isSubdomainEntry(domain)) {
        return hasConcreteLabel(domain) ? createExactHostPattern(domain) : null;
    }

    const baseDomain = domain.slice(2);

    return baseDomain ? createSubdomainPattern(baseDomain) : null;
};

/**
 * Creates an allowlist rule node for the given domain.
 *
 * @param domain Allowlist entry.
 *
 * @returns Allowlist rule node, or null if the entry contains no domain.
 */
export const createAllowlistRuleNode = (domain: string): null | NetworkRule => {
    const preparedDomain = stripWwwPrefix(domain.toLowerCase());

    if (!preparedDomain) {
        return null;
    }

    const pattern = createDomainPattern(preparedDomain);

    if (!pattern) {
        return null;
    }

    return {
        category: RuleCategory.Network,
        type: NetworkRuleType.NetworkRule,
        syntax: AdblockSyntax.Common,
        exception: true,
        pattern: {
            type: 'Value',
            value: pattern,
        },
        modifiers: {
            type: 'ModifierList',
            children: [
                {
                    type: 'Modifier',
                    name: {
                        type: 'Value',
                        value: 'document',
                    },
                },
                {
                    type: 'Modifier',
                    name: {
                        type: 'Value',
                        value: 'important',
                    },
                },
            ],
        },
    };
};
