import { getPublicSuffix } from 'tldts';

import { type DomainList } from '@adguard/agtree';
import { defaultParserOptions, DomainListParser } from '@adguard/agtree/parser';

import { WILDCARD } from '../common/constants';
import { SimpleRegex } from '../rules/simple-regex';
import { logger } from '../utils/logger';
import { isString, unescapeChar } from '../utils/string-utils';

/**
 * Comma separator.
 */
export const COMMA_SEPARATOR = ',';

/**
 * Pipe separator.
 */
export const PIPE_SEPARATOR = '|';

/**
 * Domain list separator character — `,` for the classic cosmetic domain list,
 * `|` for the `$domain` modifier.
 */
export type DomainSeparator = typeof COMMA_SEPARATOR | typeof PIPE_SEPARATOR;

/**
 * Processed domain list.
 */
export interface ProcessedDomainList {
    restrictedDomains: string[];
    permittedDomains: string[];
}

/**
 * This is a helper class that is used specifically to work
 * with domains restrictions.
 *
 * There are two options how you can add a domain restriction:
 * - `$domain` modifier;
 * - domains list for the cosmetic rules.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#domain-modifier}
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#cosmetic-rules}
 *
 * The only difference between them is that in one case we use `|` as a separator,
 * and in the other case - `,`.
 *
 * Domain values are normalized while the list is processed: the separator escape
 * is resolved in every value, plain and wildcard domains are lower-cased, and
 * regexp pattern values keep their case. Only non-basic modifier values get
 * the additional modifier escapes unescaped. The stored lists and the getters
 * return values ready to be used as regular expressions, not the raw rule text.
 *
 * @example
 * `||example.org^$domain=example.com|~sub.example.com` -- network rule
 * `example.com,~sub.example.com##banner` -- cosmetic rule
 */
export class DomainModifier {
    /**
     * List of permitted domains or null.
     */
    public readonly permittedDomains: string[] | null;

    /**
     * List of restricted domains or null.
     */
    public readonly restrictedDomains: string[] | null;

    /**
     * Processes domain list node, which means extracting permitted and restricted
     * domains from it and normalizing their values.
     *
     * @param domainListNode Domain list node to process.
     * @param nonBasicModifier Whether values use the non-basic modifier escape syntax.
     *
     * @returns Processed domain list with normalized values
     * (permitted and restricted domains) ({@link ProcessedDomainList}).
     *
     * @throws An error if a domain value is invalid.
     */
    public static processDomainList(domainListNode: DomainList, nonBasicModifier = false): ProcessedDomainList {
        const result: ProcessedDomainList = {
            permittedDomains: [],
            restrictedDomains: [],
        };

        const { children: domains, separator } = domainListNode;

        for (const { exception, value: domain } of domains) {
            const normalized = DomainModifier.normalizeDomain(domain, separator, nonBasicModifier);

            if (!SimpleRegex.isRegexPattern(normalized)
                && normalized.includes(WILDCARD)
                && !normalized.endsWith(WILDCARD)) {
                throw new SyntaxError(`Wildcards are only supported for top-level domains: "${normalized}"`);
            }

            if (exception) {
                result.restrictedDomains.push(normalized);
            } else {
                result.permittedDomains.push(normalized);
            }
        }

        return result;
    }

    /**
     * Parses the `domains` string and initializes the object.
     *
     * @param domains Domain list string or AGTree DomainList node.
     * @param separator Separator — `,` or `|`.
     * @param nonBasicModifier Whether values come from a non-basic `[$domain=...]` modifier.
     *
     * @throws An error if the domains string is empty or invalid.
     */
    constructor(domains: string | DomainList, separator: DomainSeparator, nonBasicModifier = false) {
        let processed: ProcessedDomainList;

        if (isString(domains)) {
            const node = DomainListParser.parse(
                domains.trim(),
                { ...defaultParserOptions, isLocIncluded: false },
                0,
                separator,
            );

            if (node.children.length === 0) {
                throw new SyntaxError('At least one domain must be specified');
            }

            processed = DomainModifier.processDomainList(node, nonBasicModifier);
        } else {
            // domain list node stores the separator
            if (separator !== domains.separator) {
                throw new SyntaxError('Separator mismatch');
            }

            processed = DomainModifier.processDomainList(domains, nonBasicModifier);
        }

        this.restrictedDomains = processed.restrictedDomains.length > 0 ? processed.restrictedDomains : null;
        this.permittedDomains = processed.permittedDomains.length > 0 ? processed.permittedDomains : null;
    }

    /**
     * Checks if the filtering rule is allowed on this domain.
     *
     * @param domain Domain to check.
     *
     * @returns True if the filtering rule is allowed on this domain.
     */
    public matchDomain(domain: string): boolean {
        if (this.hasRestrictedDomains()) {
            if (DomainModifier.isDomainOrSubdomainOfAny(domain, this.restrictedDomains!)) {
                // Domain or host is restricted
                // i.e. $domain=~example.org
                return false;
            }
        }

        if (this.hasPermittedDomains()) {
            if (!DomainModifier.isDomainOrSubdomainOfAny(domain, this.permittedDomains!)) {
                // Domain is not among permitted
                // i.e. $domain=example.org and we're checking example.com
                return false;
            }
        }

        return true;
    }

    /**
     * Checks if rule has permitted domains.
     *
     * @returns True if the rule has permitted domains.
     */
    public hasPermittedDomains(): boolean {
        return !!this.permittedDomains && this.permittedDomains.length > 0;
    }

    /**
     * Checks if rule has restricted domains.
     *
     * @returns True if the rule has restricted domains.
     */
    public hasRestrictedDomains(): boolean {
        return !!this.restrictedDomains && this.restrictedDomains.length > 0;
    }

    /**
     * Gets list of permitted domains.
     *
     * @returns List of permitted domains or null if none.
     */
    public getPermittedDomains(): string[] | null {
        return this.permittedDomains;
    }

    /**
     * Gets list of restricted domains.
     *
     * @returns List of restricted domains or null if none.
     */
    public getRestrictedDomains(): string[] | null {
        return this.restrictedDomains;
    }

    /**
     * Checks if `domain` is the same or a subdomain
     * of any of `domains`.
     *
     * @param domain Domain to check.
     * @param domains Domains list to check against.
     *
     * @returns True if `domain` is the same or a subdomain of any of `domains`.
     */
    public static isDomainOrSubdomainOfAny(domain: string, domains: string[]): boolean {
        for (let i = 0; i < domains.length; i += 1) {
            const d = domains[i];
            if (DomainModifier.isWildcardDomain(d)) {
                if (DomainModifier.matchAsWildcard(d, domain)) {
                    return true;
                }
            }

            if (domain === d || (domain.endsWith(d) && domain.endsWith(`.${d}`))) {
                return true;
            }

            if (SimpleRegex.isRegexPattern(d)) {
                try {
                    /**
                     * Regular expressions are cached internally by the browser
                     * (for instance, they're stored in the CompilationCache in V8/Chromium),
                     * so calling the constructor here should not be a problem.
                     *
                     * TODO: use SimpleRegex.patternFromString(d) after it is refactored to not add 'g' flag.
                     */
                    const domainPattern = new RegExp(d.slice(1, -1), 'i');
                    if (domainPattern.test(domain)) {
                        return true;
                    }
                } catch {
                    logger.error(`[tsurl.DomainModifier.isDomainOrSubdomainOfAny]: invalid regular expression as domain pattern: "${d}"`);
                }
                continue;
            }
        }

        return false;
    }

    /**
     * Checks if domain ends with wildcard.
     *
     * @param domain Domain string to check.
     *
     * @returns True if domain ends with wildcard.
     */
    public static isWildcardDomain(domain: string): boolean {
        // e.g. `*##.foo` or `.*##.foo`
        return domain.endsWith('*');
    }

    /**
     * Checks if domain string does not ends with wildcard and is not regex pattern.
     *
     * @param domain Domain string to check.
     *
     * @returns True if given domain is a wildcard or regexp pattern.
     */
    public static isWildcardOrRegexDomain(domain: string): boolean {
        return DomainModifier.isWildcardDomain(domain) || SimpleRegex.isRegexPattern(domain);
    }

    /**
     * Checks whether two domain lists can match the same request domain.
     *
     * Used by `$badfilter`: a rule with `$domain` disables the target rule for
     * the domains present in both lists. A plain domain name is compared
     * case-insensitively, because a domain name is case-insensitive, while a
     * regexp pattern keeps its case.
     *
     * The entries come from {@link getPermittedDomains}, so they are the values
     * stored after parsing, not the raw rule text: {@link normalizeDomain} has
     * already resolved the separator escape. An escaped separator in a regexp
     * entry therefore compares equal to the unescaped one here, while the
     * Manifest V3 converter compares the raw text — a pre-existing divergence
     * that the `$domain` decision has to settle.
     *
     * A wildcard TLD entry (`example.*`) therefore overlaps only an identically
     * written entry: matching it against the domains it stands for needs the
     * public suffix list, which the Manifest V3 converter does not have, and a
     * prefix-based approximation cancels rules for domains the wildcard does not
     * cover.
     *
     * @param left First domain list.
     * @param right Second domain list.
     *
     * @returns True when at least one entry of one list equals an entry of the
     *   other list. A missing list matches any domain, the same way a
     *   `$badfilter` without `$domain` disables a rule everywhere it applies.
     */
    public static haveIntersection(
        left: readonly string[] | null,
        right: readonly string[] | null,
    ): boolean {
        if (left === null || right === null) {
            return true;
        }

        return left.some((leftDomain) => right.some(
            (rightDomain) => DomainModifier.normalizeForComparison(leftDomain)
                === DomainModifier.normalizeForComparison(rightDomain),
        ));
    }

    /**
     * Brings a domain entry to the form used by the `$badfilter` comparison:
     * domain names are case-insensitive, while regexp patterns keep their case.
     *
     * @param domain Domain entry.
     *
     * @returns Domain entry to compare.
     */
    private static normalizeForComparison(domain: string): string {
        return SimpleRegex.isRegexPattern(domain) ? domain : domain.toLowerCase();
    }

    /**
     * Normalizes a single domain value after parsing.
     *
     * The separator escape is resolved in every value. Plain domains are
     * lower-cased; regexp sources retain their case and match with the `i` flag.
     * Only non-basic modifier values have an additional escape layer for
     * brackets, commas and backslashes. Basic rules and classic domain lists
     * retain their regexp escapes.
     *
     * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#non-basic-rules-modifiers}
     *
     * @param domain Domain value to normalize.
     * @param separator Separator character.
     * @param nonBasicModifier Whether to decode the non-basic modifier escape layer.
     *
     * @returns Normalized domain value.
     *
     * @throws An error if a regexp value does not compile after unescaping.
     */
    private static normalizeDomain(domain: string, separator: DomainSeparator, nonBasicModifier: boolean): string {
        const unescaped = unescapeChar(domain, separator);

        if (!SimpleRegex.isRegexPattern(unescaped)) {
            return unescaped.toLowerCase();
        }

        const pattern = nonBasicModifier ? SimpleRegex.unescapeModifierPatternValue(unescaped) : unescaped;

        try {
            // Validate compilability once at parse time, the same way
            // the pattern is compiled at match time.
            RegExp(pattern.slice(1, -1), 'i');
        } catch {
            throw new SyntaxError(`Invalid regular expression as domain pattern: "${pattern}"`);
        }

        return pattern;
    }

    /**
     * Checks if wildcard matches domain.
     *
     * @param wildcard The wildcard pattern to match against the domain.
     * @param domainNameToCheck The domain name to check against the wildcard pattern.
     *
     * @returns True if wildcard matches domain.
     */
    private static matchAsWildcard(wildcard: string, domainNameToCheck: string): boolean {
        const wildcardedDomainToCheck = DomainModifier.genTldWildcard(domainNameToCheck);
        if (wildcardedDomainToCheck) {
            return wildcardedDomainToCheck === wildcard
                || (wildcardedDomainToCheck.endsWith(wildcard) && wildcardedDomainToCheck.endsWith(`.${wildcard}`));
        }

        return false;
    }

    /**
     * Generates from domain tld wildcard.
     *
     * @param domainName The domain name to generate the TLD wildcard for.
     *
     * @returns String is empty if tld for provided domain name doesn't exists.
     *
     * @example
     * `google.com` -> `google.*`
     * `youtube.co.uk` -> `youtube.*`
     */
    private static genTldWildcard(domainName: string): string {
        // To match eTld like "com.ru" we use allowPrivateDomains wildcard
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2650
        const tld = getPublicSuffix(domainName, { allowPrivateDomains: true });
        if (tld) {
            // lastIndexOf() is needed not to match the domain, e.g. 'www.chrono24.ch'.
            // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2312.
            return `${domainName.slice(0, domainName.lastIndexOf(`.${tld}`))}.*`;
        }

        return '';
    }
}
