import { type NetworkRule, RuleFactory, createAllowlistRuleNode } from '@adguard/tsurlfilter';
import { RuleGenerator } from '@adguard/agtree';

import { ALLOWLIST_FILTER_ID } from './constants';
import { type Configuration } from './configuration';

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

        this.domains = allowlist.map((hostname: string) => {
            return hostname.startsWith('www.') ? hostname.substring(4).trim() : hostname.trim();
        });
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
