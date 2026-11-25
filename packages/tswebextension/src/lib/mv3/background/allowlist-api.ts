import { PIPE_MODIFIER_SEPARATOR } from '@adguard/agtree';
import { POPULAR_TLDS } from '@adguard/dnr-converter';

import {
    type AllowlistConfiguration,
    Allowlist as CommonAllowlist,
    type InvertedAllowlistMatch,
} from '../../common/allowlist';
import { getUpperLevelDomain } from '../../common/utils/url';

/**
 * Checks whether the host ends with a wildcard TLD, e.g. `example.*`. DNR expresses it by
 * enumerating the popular top-level domains of `@adguard/dnr-converter`, so the rule covers those
 * and no other, and only a single trailing wildcard label is supported.
 *
 * @param host Entry without the `*.` mask.
 *
 * @returns True for a host whose only wildcard is the last label.
 */
const isWildcardTld = (host: string): boolean => /^[^*]+\.\*$/.test(host);

/**
 * Checks whether DNR can express the entry in `requestDomains`: a plain domain, a `*.` mask or a
 * wildcard TLD. A wildcard inside a label (`*example.com`, `example*.com`) has no DNR equivalent.
 *
 * @param domain Normalized allowlist entry.
 *
 * @returns True if the entry has no wildcard that DNR cannot convert.
 */
const isExpressibleInDnr = (domain: string): boolean => {
    const host = domain.startsWith('*.') ? domain.slice(2) : domain;

    return !host.includes('*') || isWildcardTld(host);
};

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
         *
         * The twins are built from the normalized entries that produce a rule, so an entry without
         * a domain cannot turn into the full wildcard `*`, and MV3 behaves like MV2.
         */
        const domainWithSubDomainsMask = CommonAllowlist.prepareDomains(configuration.allowlist)
            .flatMap((domain) => (domain.startsWith('*.') ? [domain] : [domain, `*.${domain}`]));

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
        /**
         * A disabled allowlist adds no rule: with `@@$document,important` DNR would allow every
         * main frame, while `getAllowlistRules()` and `matchFrame()` filter everywhere.
         */
        if (!this.enabled) {
            return '';
        }

        /**
         * The full wildcard selects every host. In the regular mode DNR expresses that with a rule
         * without `$to`; in the inverted mode it excludes nothing, which is the absence of a rule.
         */
        if (this.domains.some(CommonAllowlist.isFullWildcardEntry)) {
            return this.inverted ? '' : '@@$document,important';
        }

        /**
         * DNR matches whole domains only, so a wildcard inside a label cannot be expressed in
         * `requestDomains`: the converter drops such a value and keeps the rule without a domain
         * condition, which would allow every site.
         */
        const allDomains = this.domains.filter(isExpressibleInDnr).map((domain) => {
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

        /**
         * In the inverted mode the rule allows every request except the listed domains, so a list
         * left without expressible entries means "allow everywhere". Without this rule DNR would
         * block everything, while `matchFrameInverted()` finds no host in such a list and
         * allowlists every frame.
         */
        if (this.inverted && allDomains.length === 0) {
            return '@@$document,important';
        }

        return AllowlistApi.getAllowlistRule(allDomains);
    }

    /**
     * Describes the hosts the inverted allowlist selects. Unlike MV2, the network layer expresses
     * it with one DNR rule, so the page-level decision and canvas protection follow what that rule
     * can match.
     *
     * @returns Host selection of the inverted DNR allowlist rule.
     */
    protected override compileInvertedMatch(): InvertedAllowlistMatch {
        const { domains } = this;

        if (domains.some(CommonAllowlist.isFullWildcardEntry)) {
            return {
                all: true,
                hosts: [],
                domains: [],
                patterns: [],
            };
        }

        const selected = new Set<string>();

        for (const domain of domains) {
            // A wildcard inside a label has no DNR equivalent: the combined rule drops the entry,
            // so the page-level decision must ignore it too.
            if (!isExpressibleInDnr(domain)) {
                continue;
            }

            const host = domain.startsWith('*.') ? getUpperLevelDomain(domain) : domain;

            if (!isWildcardTld(host)) {
                selected.add(host);
                continue;
            }

            // The converter expands a wildcard TLD into the popular top-level domains, so the
            // network layer excludes those hosts and no other.
            const prefix = host.slice(0, -'.*'.length);

            POPULAR_TLDS.forEach((tld) => selected.add(`${prefix}.${tld}`));
        }

        return {
            all: false,
            hosts: [],
            domains: [...selected],
            patterns: [],
        };
    }
}

export const allowlistApi = new AllowlistApi();
