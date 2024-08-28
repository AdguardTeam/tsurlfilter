import { type IRuleList, createAllowlistRuleList } from '@adguard/tsurlfilter';

import { Allowlist as CommonAllowlist } from '../../common/allowlist';
import { ALLOWLIST_FILTER_ID } from '../../common/constants';

/**
 * The allowlist is used to exclude certain websites from filtering.
 * Blocking rules are not applied to the sites in the list.
 * The allow list can also be inverted.
 * In inverted mode, the application will unblock ads everywhere except for the
 * sites added to this list.
 */
export class AllowlistApi extends CommonAllowlist {
    /**
     * Creates one allowlist rule for all allowlistRules. This one combined rule
     * will be passed to the DNR converter.
     *
     * NOTE: We use $to (_to domains_) modifier instead of $domain (_from domains_),
     * because it is needed to match frame request itself and all requests from
     * this frame.
     * @see https://groups.google.com/a/chromium.org/g/chromium-extensions/c/S0TtE9Vk4N4/m/hPtSafzVAQAJ
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#to-modifier
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#domain-modifier
     *
     * @example
     * // configuration = { allowlist: 'example.com, example.org', enabled: true, inverted: false }
     * combineAllowListRules() -> '@@$document,to=example.com|example.org'
     *
     * @example
     * // configuration = { allowlist: 'example.com, example.org', enabled: true, inverted: true }
     * combineAllowListRules() -> '@@$document,to=~example.com|~example.org'
     *
     * @returns Combined rule in AG format.
     */
    public combineAllowListRulesForDNR(): string {
        const allDomains = this.domains
            .map((domain) => (this.inverted ? `~${domain}` : domain))
            .join('|');

        return allDomains.length > 0 ? `@@$document,to=${allDomains}` : '';
    }

    /**
     * Returns a list of rules to be loaded into the engine based on allowlist
     * state. For MV3 we add "*." for each domain to make matching algorithm
     * same as in DNR: requestDomains and excludedRequestDomains in MV3 will
     * match all subdomains of the domain.
     *
     * @returns List of allowlist rules or null.
     */
    public getAllowlistRules(): IRuleList | null {
        if (!this.enabled || this.inverted) {
            return null;
        }

        const domainWithSubDomainsMask = this.domains
            .reduce<string[]>((out, domain) => {
                out.push(domain);

                if (!domain.startsWith('*.')) {
                    out.push(`*.${domain}`);
                }

                return out;
            }, []);

        return createAllowlistRuleList(
            ALLOWLIST_FILTER_ID,
            domainWithSubDomainsMask,
        );
    }
}

export const allowlistApi = new AllowlistApi();
