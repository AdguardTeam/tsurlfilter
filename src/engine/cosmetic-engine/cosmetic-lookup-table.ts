import { CosmeticRule } from '../../cosmetic-rule';

export class CosmeticLookupTable {
    private byHostname: Map<string, CosmeticRule[]>;

    public genericRules: CosmeticRule[];

    private whitelist: Map<string, CosmeticRule[]>;

    constructor() {
        // map with rules grouped by the permitted domains names
        this.byHostname = new Map();
        // list of generic rules
        this.genericRules = [] as CosmeticRule[];
        // map with whitelist rules. key is the rule content
        this.whitelist = new Map();
    }

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

    findByHostname(hostname: string): CosmeticRule[] {
        const rules = this.byHostname.get(hostname) || [] as CosmeticRule[];

        return rules.filter((rule) => !rule.isWhitelist());
    }

    isWhitelisted(hostname: string, rule: CosmeticRule): boolean {
        const whitelistedRules = this.whitelist.get(rule.getContent());

        if (!whitelistedRules) {
            return false;
        }

        return whitelistedRules.some((whitelistedRule) => whitelistedRule.match(hostname));
    }
}
