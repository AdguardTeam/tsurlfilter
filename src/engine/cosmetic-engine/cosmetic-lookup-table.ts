import { parse } from 'tldts';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/utils';
import { RuleStorage } from '../../filterlist/rule-storage';

/**
 * CosmeticLookupTable lets quickly lookup cosmetic rules for the specified hostname.
 * It is primarily used by the {@see CosmeticEngine}.
 */
export class CosmeticLookupTable {
    /**
     * Map with rules indices grouped by the permitted domains names
     */
    private byHostname: Map<number, number[]>;

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
     * Map with allowlist rules indices. Key is the rule content.
     * More information about allowlist here:
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#element-hiding-rules-exceptions
     */
    private allowlist: Map<number, number[]>;

    /**
     * Storage for the filtering rules
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Creates a new instance
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage) {
        this.byHostname = new Map();
        this.wildcardRules = [] as CosmeticRule[];
        this.genericRules = [] as CosmeticRule[];
        this.allowlist = new Map();
        this.ruleStorage = storage;
    }

    /**
     * Adds rule to the appropriate collection
     * @param rule
     * @param storageIdx
     */
    addRule(rule: CosmeticRule, storageIdx: number): void {
        if (rule.isAllowlist()) {
            const key = fastHash(rule.getContent());
            const existingRules = this.allowlist.get(key) || [] as number[];
            existingRules.push(storageIdx);
            this.allowlist.set(key, existingRules);
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
                const key = fastHash(parsedDomain);
                const rules = this.byHostname.get(key) || [] as number[];
                rules.push(storageIdx);
                this.byHostname.set(key, rules);
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
            const rulesIndexes = this.byHostname.get(fastHash(subdomain));
            if (rulesIndexes) {
                for (let j = 0; j < rulesIndexes.length; j += 1) {
                    const rule = this.ruleStorage.retrieveRule(rulesIndexes[j]) as CosmeticRule;
                    if (rule && rule.match(hostname)) {
                        result.push(rule);
                    }
                }
            }
        }

        result.push(...this.wildcardRules.filter((r) => r.match(hostname)));

        return result.filter((rule) => !rule.isAllowlist());
    }

    /**
     * Checks if the rule is disabled on the specified hostname.
     * @param hostname
     * @param rule
     */
    isAllowlisted(hostname: string, rule: CosmeticRule): boolean {
        const rulesIndexes = this.allowlist.get(fastHash(rule.getContent()));

        if (!rulesIndexes) {
            return false;
        }

        for (let j = 0; j < rulesIndexes.length; j += 1) {
            const r = this.ruleStorage.retrieveRule(rulesIndexes[j]) as CosmeticRule;
            if (r && r.match(hostname)) {
                return true;
            }
        }

        return false;
    }
}
