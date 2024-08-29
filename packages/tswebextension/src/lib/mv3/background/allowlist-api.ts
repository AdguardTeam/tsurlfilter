import { type AllowlistConfiguration, Allowlist as CommonAllowlist } from '../../common/allowlist';
import { getUpperLevelDomain } from '../../common/utils/url';

/**
 * The allowlist is used to exclude certain websites from filtering.
 * Blocking rules are not applied to the sites in the list.
 * The allow list can also be inverted.
 * In inverted mode, the application will unblock ads everywhere except for the
 * sites added to this list.
 */
export class AllowlistApi extends CommonAllowlist {
    /**
     * Configures allowlist state based on app configuration.
     *
     * @param configuration App configuration.
     */
    public configure(configuration: AllowlistConfiguration): void {
        /**
         * For MV3 we add "*." for each domain to make matching algorithm
         * same as in DNR engine: requestDomains and excludedRequestDomains in
         * DNR will match all subdomains of the domain by default.
         */
        const domainWithSubDomainsMask = configuration.allowlist.reduce<string[]>((acc, domain) => {
            acc.push(domain);

            if (!domain.startsWith('*.')) {
                acc.push(`*.${domain}`);
            }

            return acc;
        }, []);

        super.configure({
            ...configuration,
            allowlist: domainWithSubDomainsMask,
        });
    }

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
        const allDomains = this.domains.map((domain) => {
            // Map subdomain masks to upper domains records, because masks itself
            // will be ignored by DNR. Transforming masks to upper domains will
            // match all subdomains by default in DNR.
            // We added them for consistency between DNR engine and
            // our tsurlfilter (for cosmetic in MV3).
            const d = domain.startsWith('*.')
                ? getUpperLevelDomain(domain)
                : domain;

            return this.inverted ? `~${d}` : d;
        });

        const concatenatedUniqueDomains = Array.from(new Set(allDomains)).join('|');

        return allDomains.length > 0 ? `@@$document,to=${concatenatedUniqueDomains}` : '';
    }
}

export const allowlistApi = new AllowlistApi();
