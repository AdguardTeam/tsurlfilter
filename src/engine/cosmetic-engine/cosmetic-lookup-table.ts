import { CosmeticRule } from '../../cosmetic-rule';

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
            for (const domain of domains) {
                const rules = this.byHostname.get(domain) || [] as CosmeticRule[];
                rules.push(rule);
                this.byHostname.set(domain, rules);
            }
        }
    }

    /**
     * Finds rules by hostname
     * @param hostname
     */
    findByHostname(hostname: string): CosmeticRule[] {
        const rules = this.byHostname.get(hostname) || [] as CosmeticRule[];

        return rules.filter((rule) => !rule.isWhitelist());
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
