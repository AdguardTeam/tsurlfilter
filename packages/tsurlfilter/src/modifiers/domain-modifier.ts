import { getPublicSuffix } from 'tldts';
import { DomainList, DomainListParser } from '@adguard/agtree';

import { logger } from '../utils/logger';
import { SimpleRegex } from '../rules/simple-regex';
import { isString, unescapeChar } from '../utils/string-utils';
import { WILDCARD } from '../common/constants';

/**
 * Comma separator
 */
export const COMMA_SEPARATOR = ',';

/**
 * Pipe separator
 */
export const PIPE_SEPARATOR = '|';

/**
 * Processed domain list
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
 * * `$domain` modifier: https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#domain-modifier
 * * domains list for the cosmetic rules
 *
 * The only difference between them is that in one case we use `|` as a separator,
 * and in the other case - `,`.
 *
 * Examples:
 * * `||example.org^$domain=example.com|~sub.example.com` -- network rule
 * * `example.com,~sub.example.com##banner` -- cosmetic rule
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
     * domains from it.
     *
     * @param domainListNode Domain list node to process
     * @returns Processed domain list (permitted and restricted domains) ({@link ProcessedDomainList})
     */
    public static processDomainList(domainListNode: DomainList): ProcessedDomainList {
        const result: ProcessedDomainList = {
            permittedDomains: [],
            restrictedDomains: [],
        };

        const { children: domains } = domainListNode;

        for (const { exception, value: domain } of domains) {
            const domainLowerCased = domain.toLowerCase();

            if (!SimpleRegex.isRegexPattern(domain) && domain.includes(WILDCARD) && !domain.endsWith(WILDCARD)) {
                throw new SyntaxError(`Wildcards are only supported for top-level domains: "${domain}"`);
            }

            if (exception) {
                result.restrictedDomains.push(domainLowerCased);
            } else {
                result.permittedDomains.push(domainLowerCased);
            }
        }

        return result;
    }

    /**
     * Parses the `domains` string and initializes the object.
     *
     * @param domains Domain list string or AGTree DomainList node.
     * @param separator Separator — `,` or `|`.
     *
     * @throws An error if the domains string is empty or invalid
     */
    constructor(domains: string | DomainList, separator: typeof COMMA_SEPARATOR | typeof PIPE_SEPARATOR) {
        let processed: ProcessedDomainList;

        if (isString(domains)) {
            const node = DomainListParser.parse(domains.trim(), { separator, isLocIncluded: false });

            if (node.children.length === 0) {
                throw new SyntaxError('At least one domain must be specified');
            }

            processed = DomainModifier.processDomainList(node);
        } else {
            // domain list node stores the separator
            if (separator !== domains.separator) {
                throw new SyntaxError('Separator mismatch');
            }

            processed = DomainModifier.processDomainList(domains);
        }

        // Unescape separator character in domains
        processed.permittedDomains = processed.permittedDomains.map((domain) => unescapeChar(domain, separator));
        processed.restrictedDomains = processed.restrictedDomains.map((domain) => unescapeChar(domain, separator));

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
     * Checks if rule has permitted domains
     */
    public hasPermittedDomains(): boolean {
        return !!this.permittedDomains && this.permittedDomains.length > 0;
    }

    /**
     * Checks if rule has restricted domains
     */
    public hasRestrictedDomains(): boolean {
        return !!this.restrictedDomains && this.restrictedDomains.length > 0;
    }

    /**
     * Gets list of permitted domains.
     */
    public getPermittedDomains(): string[] | null {
        return this.permittedDomains;
    }

    /**
     * Gets list of restricted domains.
     */
    public getRestrictedDomains(): string[] | null {
        return this.restrictedDomains;
    }

    /**
     * isDomainOrSubdomainOfAny checks if `domain` is the same or a subdomain
     * of any of `domains`.
     *
     * @param domain - domain to check
     * @param domains - domains list to check against
     *
     * @returns true if `domain` is the same or a subdomain of any of `domains`
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
                     * TODO use SimpleRegex.patternFromString(d) after it is refactored to not add 'g' flag
                     */
                    const domainPattern = new RegExp(d.slice(1, -1));
                    if (domainPattern.test(domain)) {
                        return true;
                    }
                } catch {
                    logger.error(`Invalid regular expression as domain pattern: "${d}"`);
                }
                continue;
            }
        }

        return false;
    }

    /**
     * Checks if domain ends with wildcard
     *
     * @param domain domain string to check
     *
     * @returns true if domain ends with wildcard
     */
    public static isWildcardDomain(domain: string): boolean {
        return domain.endsWith('.*');
    }

    /**
     * Checks if domain string does not ends with wildcard and is not regex pattern
     *
     * @param domain domain string to check
     *
     * @returns true if given domain is a wildcard or regexp pattern
     */
    public static isWildcardOrRegexDomain(domain: string): boolean {
        return DomainModifier.isWildcardDomain(domain) || SimpleRegex.isRegexPattern(domain);
    }

    /**
     * Checks if wildcard matches domain
     *
     * @param wildcard
     * @param domainNameToCheck
     *
     * @returns true if wildcard matches domain
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
     * Generates from domain tld wildcard e.g. google.com -> google.* ; youtube.co.uk -> youtube.*
     *
     * @param domainName
     *
     * @returns string is empty if tld for provided domain name doesn't exists
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
