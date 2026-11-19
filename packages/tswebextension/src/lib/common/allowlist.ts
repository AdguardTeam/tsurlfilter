import { RuleGenerator } from '@adguard/agtree';
import {
    createAllowlistRuleNode,
    type NetworkRule,
    normalizeAllowlistDomain,
    Request,
    RequestType,
    RuleFactory,
} from '@adguard/tsurlfilter';

import { type Configuration } from './configuration';
import { ALLOWLIST_FILTER_ID } from './constants';

/**
 * Configuration for the allowlist.
 */
export type AllowlistConfiguration = Pick<Configuration, 'allowlist' | 'settings'>;

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
    public configure(configuration: AllowlistConfiguration): void {
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

        this.domains = Allowlist.prepareDomains(allowlist);
    }

    /**
     * Checks whether a host is selected by any configured allowlist entry.
     *
     * @param domain Hostname to match.
     *
     * @returns True if at least one entry matches the host.
     */
    public isDomainListed(domain: string): boolean {
        const request = new Request(`https://${domain}/`, null, RequestType.Document);

        return this.domains.some((listedDomain) => {
            const rule = Allowlist.createAllowlistRule(listedDomain);

            if (rule?.match(request)) {
                return true;
            }

            // A trailing-TLD wildcard also selects subdomains in inverted mode.
            // Leading-subdomain wildcards already include the apex and every depth.
            if (!listedDomain.endsWith('.*') || listedDomain.startsWith('*.')) {
                return false;
            }

            const subdomainRule = Allowlist.createAllowlistRule(`*.${listedDomain}`);

            return subdomainRule?.match(request) ?? false;
        });
    }

    /**
     * Normalizes the configured entries and keeps the ones the allowlist can match, so every
     * consumer of {@link domains} — the generated rules, the canvas protection policy and the MV3
     * twins — sees the same list.
     *
     * @param allowlist Allowlist entries from the configuration.
     *
     * @returns Normalized entries that produce an allowlist rule.
     */
    protected static prepareDomains(allowlist: string[]): string[] {
        return allowlist
            .map((hostname) => normalizeAllowlistDomain(hostname))
            .filter((domain) => createAllowlistRuleNode(domain) !== null);
    }

    /**
     * Returns a list of rules to be loaded into the engine based on allowlist state.
     *
     * @returns List of allowlist rules or null.
     */
    public getAllowlistRules(): string | null {
        if (!this.enabled || this.inverted) {
            return null;
        }

        const rules = this.domains
            .map((domain) => createAllowlistRuleNode(domain))
            .filter((r) => r !== null)
            .map(RuleGenerator.generate);

        return rules.join('\n');
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

        return RuleFactory.createAllowlistRule(domain, ALLOWLIST_FILTER_ID);
    }
}
