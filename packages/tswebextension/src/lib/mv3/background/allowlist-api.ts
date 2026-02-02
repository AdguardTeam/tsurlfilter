import { PIPE_MODIFIER_SEPARATOR } from '@adguard/agtree';

import { type AllowlistConfiguration, Allowlist as CommonAllowlist } from '../../common/allowlist';
import { getUpperLevelDomain } from '../../common/utils/url';

/**
 * The allowlist is used to exclude certain websites from filtering.
 * Blocking rules are not applied to the sites in the list.
 * The allowlist can also be inverted.
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
     * Creates allowlist rule for domains list.
     *
     * @param domains Domains to create allowlist rule for.
     *
     * @returns Allowlist rule for given domains or empty string if domains list is empty.
     *
     * @example
     * ```
     * const domains1 = ['example.com', 'example.org']
     * getAllowlistRule(domains1) -> '@@$document,to=example.com|example.org'
     *
     * const domains2 = []
     * getAllowlistRule(domains2) -> ''
     * ```
     */
    public static getAllowlistRule(domains: string[]): string {
        if (domains.length === 0) {
            return '';
        }

        const concatenatedUniqueDomains = Array.from(new Set(domains)).join(PIPE_MODIFIER_SEPARATOR);
        // Adding $important to ensure the allowlist rule takes precedence over
        // blocking rules that use important modifiers (AG-42867)
        // e.g. '@@$document,important,to=example.com|example.org'
        return `@@$document,important,to=${concatenatedUniqueDomains}`;
    }

    /**
     * Creates one allowlist rule for all allowlistRules. This one combined rule
     * will be passed to the DNR converter.
     *
     * NOTE: We use $to (_to domains_) modifier instead of $domain (_from domains_),
     * because it is needed to match frame request itself and all requests from
     * this frame.
     *
     * @see https://groups.google.com/a/chromium.org/g/chromium-extensions/c/S0TtE9Vk4N4/m/hPtSafzVAQAJ
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#to-modifier
     * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#domain-modifier
     *
     * @returns Combined rule in AG format.
     */
    public combineAllowListRulesForDNR(): string {
        // In inverted allowlist mode with an empty list, we must not block anything anywhere.
        // To ensure that browser DNR does not block requests, generate a global allowlist
        // rule that applies to all documents.
        if (this.inverted && this.domains.length === 0) {
            return '@@$document,important';
        }

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

        return AllowlistApi.getAllowlistRule(allDomains);
    }
}

export const allowlistApi = new AllowlistApi();
