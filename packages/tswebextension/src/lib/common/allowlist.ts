import { BufferRuleList, type IRuleList, NetworkRule } from '@adguard/tsurlfilter';

import { ALLOWLIST_FILTER_ID } from './constants';
import { type Configuration } from './configuration';

/**
 * The allowlist is used to exclude certain websites from filtering.
 * Blocking rules are not applied to the sites in the list.
 * The allow list can also be inverted.
 * In inverted mode, the application will unblock ads everywhere except for the
 * sites added to this list.
 */
export abstract class Allowlist {
    /**
     * Indicates whether the allowlist is enabled.
     */
    public enabled = false;

    /**
     * If true, ads will be blocked only on sites listed in the allowlist,
     * like "blocklist" mode.
     */
    public inverted = false;

    /**
     * List of domains which are allowed (by default)
     * or blocked (if the allowlist is inverted).
     */
    public domains: string[] = [];

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

        this.domains = allowlist.map((hostname: string) => {
            return hostname.startsWith('www.') ? hostname.substring(4).trim() : hostname.trim();
        });
    }

    /**
     * Returns a list of rules to be loaded into the engine based on allowlist state.
     *
     * @returns List of allowlist rules or null.
     */
    public getAllowlistRules(): IRuleList | null {
        if (!this.enabled || this.inverted) {
            return null;
        }

        return new BufferRuleList(
            ALLOWLIST_FILTER_ID,
            this.domains.map(Allowlist.createAllowlistRuleString).join('\n'),
        );
    }

    /**
     * Creates an allowlist rule for a domain which will be passed to our engine
     * to unblock requests. In MV3 we will pass this rule to TsUrlFilter engine,
     * because it do work with cosmetic rules.
     *
     * @param domain Domain name.
     *
     * @returns Allowlist rule or null.
     */
    public static createAllowlistRule(domain: string): NetworkRule | null {
        if (!domain) {
            return null;
        }

        const ruleString = Allowlist.createAllowlistRuleString(domain);

        return new NetworkRule(ruleString, ALLOWLIST_FILTER_ID);
    }

    /**
     * Creates a rule string based on the specified domain.
     *
     * @param domain Allowlisted domain.
     *
     * @returns Allowlist rule string.
     */
    protected static createAllowlistRuleString(domain: string): string {
        // Special case for wildcard tld + n domain.
        if (domain.startsWith('*.')) {
            return String.raw`@@||${domain.slice(2)}$document,important`;
        }

        // In other cases we use regexp to match domain
        // and its 'www' subdomain strictly.
        let regexp = '';

        // Transform allowlist domain special characters.
        for (let i = 0; i < domain.length; i += 1) {
            const char = domain[i];

            // Transform wildcard to regexp equivalent.
            if (char === '*') {
                regexp += '.*';
            // Escape domain separator.
            } else if (char === '.') {
                regexp += String.raw`\.`;
            } else {
                regexp += char;
            }
        }

        return String.raw`@@///(www\.)?${regexp}/$document,important`;
    }
}
