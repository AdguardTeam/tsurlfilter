/**
 * @file Utility functions for domain and hostname validation.
 */

import { parse } from 'tldts';
import { ASTERISK, DOT } from './constants';

const WILDCARD = ASTERISK; // *
const WILDCARD_TLD = DOT + WILDCARD; // .*
const WILDCARD_SUBDOMAIN = WILDCARD + DOT; // *.

export class DomainUtils {
    /**
     * Check if the input is a valid domain or hostname.
     *
     * @param domain Domain to check
     * @returns `true` if the domain is valid, `false` otherwise
     */
    public static isValidDomainOrHostname(domain: string): boolean {
        let domainToCheck = domain;

        // Wildcard-only domain, typically a generic rule
        if (domainToCheck === WILDCARD) {
            return true;
        }

        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#wildcard-for-tld
        if (domainToCheck.endsWith(WILDCARD_TLD)) {
            // Remove the wildcard TLD
            domainToCheck = domainToCheck.substring(0, domainToCheck.length - WILDCARD_TLD.length);
        }

        if (domainToCheck.startsWith(WILDCARD_SUBDOMAIN)) {
            // Remove the wildcard subdomain
            domainToCheck = domainToCheck.substring(WILDCARD_SUBDOMAIN.length);
        }

        // Parse the domain with tldts
        const tldtsResult = parse(domainToCheck);

        // Check if the domain is valid
        return domainToCheck === tldtsResult.domain || domainToCheck === tldtsResult.hostname;
    }
}
