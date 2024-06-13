import {
    type NetworkRule,
    type IRuleList,
    RuleFactory,
    createAllowlistRuleList,
} from '@adguard/tsurlfilter';

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
    public getAllowlistRules(): IRuleList | null {
        if (this.enabled && !this.inverted) {
            return createAllowlistRuleList(ALLOWLIST_FILTER_ID, this.domains);
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
        return RuleFactory.createAllowlistRule(domain, ALLOWLIST_FILTER_ID);
    }
}
