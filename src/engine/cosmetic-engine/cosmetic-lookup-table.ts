import { parse } from 'tldts';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { DomainModifier } from '../../modifiers/domain-modifier';

/**
 * CosmeticLookupTable lets quickly lookup cosmetic rules for the specified hostname.
 * It is primarily used by the {@see CosmeticEngine}.
 */
export class CosmeticLookupTable {
    /**
     * Map with rules grouped by the permitted domains names
     */
    private byHostname: Map<string, CosmeticRule[]>;

    /**
     * Collection of domain specific rules, those could not be grouped by domain name
     * For instance, wildcard domain rules.
     */
    public wildcardRules: CosmeticRule[];

    /**
     * Collection of generic rules.
     * Generic means that the rule is not limited to particular websites and works (almost) everywhere.
     */
    public genericRules: CosmeticRule[];

    /**
     * Map with whitelist rules. Key is the rule content.
     * More information about whitelist here:
     *  https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#element-hiding-rules-exceptions
     */
    private whitelist: Map<string, CosmeticRule[]>;

    constructor() {
        this.byHostname = new Map();
        this.wildcardRules = [] as CosmeticRule[];
        this.genericRules = [] as CosmeticRule[];
        this.whitelist = new Map();
    }

    /**
     * Adds rule to the appropriate collection
     * @param rule
     */
    addRule(rule: CosmeticRule): void {
        if (rule.isWhitelist()) {
            const ruleContent = rule.getContent();
            const existingRules = this.whitelist.get(ruleContent) || [] as CosmeticRule[];
            existingRules.push(rule);
            this.whitelist.set(ruleContent, existingRules);
            return;
        }

        if (rule.isGeneric()) {
            this.genericRules.push(rule);
            return;
        }

        const domains = rule.getPermittedDomains();
        if (domains) {
            const hasWildcardDomain = domains.some((d) => DomainModifier.isWildcardDomain(d));
            if (hasWildcardDomain) {
                this.wildcardRules.push(rule);
                return;
            }

            for (const domain of domains) {
                const tldResult = parse(domain);
                // tldResult.domain equals to eTLD domain,
                // e.g. sub.example.uk.org would result in example.uk.org
                const parsedDomain = tldResult.domain || domain;
                const rules = this.byHostname.get(parsedDomain) || [] as CosmeticRule[];
                rules.push(rule);
                this.byHostname.set(parsedDomain, rules);
            }
        }
    }

    /**
     * Finds rules by hostname
     * @param hostname
     * @param subdomains
     */
    findByHostname(hostname: string, subdomains: string[]): CosmeticRule[] {
        const result = [] as CosmeticRule[];

        // Iterate over all sub-domains
        for (let i = 0; i < subdomains.length; i += 1) {
            const subdomain = subdomains[i];
            const rules = this.byHostname.get(subdomain);
            if (rules && rules.length > 0) {
                result.push(...rules.filter((r) => r.match(hostname)));
            }
        }

        result.push(...this.wildcardRules.filter((r) => r.match(hostname)));

        return result.filter((rule) => !rule.isWhitelist());
    }

    /**
     * Checks if the rule is disabled on the specified hostname.
     * @param hostname
     * @param rule
     */
    isWhitelisted(hostname: string, rule: CosmeticRule): boolean {
        const whitelistedRules = this.whitelist.get(rule.getContent());

        if (!whitelistedRules) {
            return false;
        }

        return whitelistedRules.some((whitelistedRule) => whitelistedRule.match(hostname));
    }
}
