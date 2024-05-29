import { type IRuleList, BufferRuleList, NetworkRule } from '@adguard/tsurlfilter';

import { ALLOWLIST_FILTER_ID } from '../../common/constants';

/**
 * The allowlist is used to exclude certain websites from filtering.
 * Blocking rules are not applied to the sites in the list.
 * The allow list can also be inverted.
 * In inverted mode, the application will unblock ads everywhere except for the
 * sites added to this list.
 */
export class AllowlistApi {
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
     * List of allowlisted or blacklisted (see inverted) domains.
     */
    public domains: string[] = [];

    /**
     * Updates the current allowlist state.
     *
     * @param enabled Is allowlist enabled.
     * @param inverted If true, rules will be generated with "excluded" condition.
     * @param domains List of domains.
     */
    public updateState(enabled: boolean, inverted: boolean, domains: string[]): void {
        this.enabled = enabled;
        this.inverted = inverted;
        this.domains = domains;
    }

    /**
     * Returns a list of rules to be loaded into the engine based
     * on the allowlist state.
     *
     * @returns List of allowlist rules or null.
     */
    public createRuleList(): IRuleList | null {
        if (!this.enabled || this.inverted) {
            return null;
        }

        return new BufferRuleList(
            // NOTE: Here we use ALLOWLIST_FILTER_ID, but in DNR section we use
            // USER_FILTER_ID for allowlist rules.
            // TODO: This needs to be changed in the future.
            ALLOWLIST_FILTER_ID,
            this.domains.map(AllowlistApi.createAllowlistRuleString).join('\n'),
        );
    }

    /**
     * Creates one allowlist rule for all allowlistRules. This one combined rule
     * will be passed to the DNR converter.
     * NOTE: We use $to (to domains) modifier instead of $domain (from domains),
     * because it is needed to match frame request itself and all requests from
     * this frame.
     * @see https://groups.google.com/a/chromium.org/g/chromium-extensions/c/S0TtE9Vk4N4/m/hPtSafzVAQAJ
     *
     * @example
     * updateState(true, true, ['example.com, example.org'])
     * combineAllowListRules() -> '@@$document,to=example.com|example.org'
     *
     * @example
     * updateState(true, false, ['example.com, example.org'])
     * combineAllowListRules() -> '@@$document,to=~example.com|~example.org'
     *
     * @returns Combined rule in AG format.
     */
    public combineAllowListRules(): string {
        const domains = this.domains.map((hostname) => {
            return hostname.startsWith('www.') ? hostname.substring(4).trim() : hostname.trim();
        });

        const allDomains = domains
            .map((domain) => (this.inverted ? `~${domain}` : `${domain}`))
            .join('|');

        return `@@$document,to=${allDomains}`;
    }

    /**
     * Creates an allowlist rule for a domain which will be passed to our engine
     * to unblock requests. Our engine needs this to work with cosmetic rules.
     *
     * @param domain Domain name.
     *
     * @returns Allowlist rule or null.
     */
    public static createAllowlistRule(domain: string): null | NetworkRule {
        if (!domain) {
            return null;
        }

        const ruleString = AllowlistApi.createAllowlistRuleString(domain);

        return new NetworkRule(ruleString, ALLOWLIST_FILTER_ID);
    }

    /**
     * Creates a rule string based on the specified domain.
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

export const allowlistApi = new AllowlistApi();
