import { NetworkRule, StringRuleList } from '@adguard/tsurlfilter';

import { ALLOWLIST_FILTER_ID } from '../../common/constants';
import type { Configuration } from '../../common/configuration';

/**
 * The allowlist is used to exclude certain websites from filtering.
 * Blocking rules are not applied to the sites in the list.
 * The allow list can also be inverted.
 * In inverted mode, the application will unblock ads everywhere except for the sites added to this list.
 */
export class Allowlist {
    public domains: string[] = [];

    public inverted = false;

    public enabled = false;

    /**
     * Configures allowlist state based on app configuration.
     *
     * @param configuration App configuration.
     */
    public configure(configuration: Configuration): void {
        const {
            allowlist,
            settings,
        } = configuration;

        const {
            allowlistEnabled,
            allowlistInverted,
        } = settings;

        this.enabled = allowlistEnabled;
        this.inverted = allowlistInverted;

        const domains: string[] = [];

        allowlist.forEach((hostname) => {
            domains.push(hostname.startsWith('www.') ? hostname.substring(4) : hostname);
        });

        this.domains = domains;
    }

    /**
     * Returns a list of rules to be loaded into the engine based on allowlist state.
     *
     * @returns List of allowlist rules or null.
     */
    public getAllowlistRules(): StringRuleList | null {
        if (this.enabled && !this.inverted) {
            return new StringRuleList(
                ALLOWLIST_FILTER_ID,
                this.domains.map((domain) => {
                    return Allowlist.createAllowlistRuleString(domain);
                }).join('\n'),
            );
        }

        return null;
    }

    /**
     * Creates allowlist rule for domain.
     *
     * @param domain Domain name.
     * @returns Allowlist rule or null.
     */
    public static createAllowlistRule(domain: string): null | NetworkRule {
        if (!domain) {
            return null;
        }

        const ruleString = Allowlist.createAllowlistRuleString(domain);

        return new NetworkRule(ruleString, ALLOWLIST_FILTER_ID);
    }

    /**
     * Creates rule string based on specified domain.
     *
     * @param domain Allowlisted domain.
     *
     * @returns Allowlist rule string.
     */
    private static createAllowlistRuleString(domain: string): string {
        // Special case for wildcard tld + n domain.
        if (domain.startsWith('*.')) {
            return String.raw`@@||${domain.slice(2)}$document,important`;
        }

        // In other cases we use regexp to match domain and it`s 'www' subdomain strictly.
        let regexp = '';

        // transform allowlist domain special characters
        for (let i = 0; i < domain.length; i += 1) {
            const char = domain[i];

            // transform wildcard to regexp equivalent
            if (char === '*') {
                regexp += '.*';
            // escape domain separator
            } else if (char === '.') {
                regexp += String.raw`\.`;
            } else {
                regexp += char;
            }
        }

        return String.raw`@@///(www\.)?${regexp}/$document,important`;
    }
}
