import { parse } from 'tldts';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/string-utils';
import { RuleStorage } from '../../filterlist/rule-storage';
import { Request } from '../../request';

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
     * List of domain-specific rules that are not organized into any index structure.
     * These rules are sequentially scanned one by one.
     */
    public seqScanRules: CosmeticRule[];

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
    private allowlist: Map<string, number[]>;

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
        this.seqScanRules = [] as CosmeticRule[];
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
            const key = rule.getContent();
            const existingRules = this.allowlist.get(key) || [] as number[];
            existingRules.push(storageIdx);
            this.allowlist.set(key, existingRules);
            return;
        }

        if (rule.isGeneric()) {
            this.genericRules.push(rule);
            return;
        }

        const permittedDomains = rule.getPermittedDomains();
        if (permittedDomains) {
            if (permittedDomains.some(DomainModifier.isWildcardOrRegexDomain)) {
                this.seqScanRules.push(rule);
                return;
            }
            for (const domain of permittedDomains) {
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
     * @param request
     * @param subdomains
     */
    findByHostname(request: Request): CosmeticRule[] {
        const result = [] as CosmeticRule[];
        const { subdomains } = request;
        // Iterate over all sub-domains
        for (let i = 0; i < subdomains.length; i += 1) {
            const subdomain = subdomains[i];
            let rulesIndexes = this.byHostname.get(fastHash(subdomain));
            if (rulesIndexes) {
                // Filtering out duplicates
                rulesIndexes = rulesIndexes.filter((v, index) => rulesIndexes!.indexOf(v) === index);
                for (let j = 0; j < rulesIndexes.length; j += 1) {
                    const rule = this.ruleStorage.retrieveRule(rulesIndexes[j]) as CosmeticRule;
                    if (rule && !rule.isAllowlist() && rule.match(request)) {
                        result.push(rule);
                    }
                }
            }
        }

        result.push(...this.seqScanRules.filter((r) => !r.isAllowlist() && r.match(request)));

        return result;
    }

    /**
     * Checks if the rule is disabled on the specified hostname.
     * @param request
     * @param rule
     */
    isAllowlisted(request: Request, rule: CosmeticRule): boolean {
        const rulesIndexes = this.allowlist.get(rule.getContent());
        if (!rulesIndexes) {
            return false;
        }

        for (let j = 0; j < rulesIndexes.length; j += 1) {
            const r = this.ruleStorage.retrieveRule(rulesIndexes[j]) as CosmeticRule;
            if (r && r.match(request)) {
                return true;
            }
        }

        return false;
    }
}
