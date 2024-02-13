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
    private allowlist: Map<string, number[]>;

    /**
     * Storage for the filtering rules
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Map just for special allowlist scriptlet rules indices. Key is the scriptlet name.
     * Examples of rules:
     * - #@%#//scriptlet()
     * - example.org#@%#//scriptlet()
     * - #@%#//scriptlet("set-cookie")
     */
    private allowlistScriptlets: Map<null | string, number[]>;

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
        this.allowlistScriptlets = new Map();
        this.ruleStorage = storage;
    }

    /**
     * Adds rule to the appropriate collection
     * @param rule
     * @param storageIdx
     */
    addRule(rule: CosmeticRule, storageIdx: number): void {
        if (rule.isAllowlist()) {
            if (
                rule.scriptletOptions
                && rule.scriptletOptions.name !== undefined
                && rule.scriptletOptions.args.length === 0
            ) {
                const { name } = rule.scriptletOptions;
                const existingRules = this.allowlistScriptlets.get(name) || [];
                existingRules.push(storageIdx);
                this.allowlistScriptlets.set(name, existingRules);
                return;
            }
            const key = rule.getContent();
            const existingRules: number[] = this.allowlist.get(key) || [];
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
     * @param request
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
                    if (rule && rule.match(request)) {
                        result.push(rule);
                    }
                }
            }
        }

        result.push(...this.wildcardRules.filter((r) => r.match(request)));

        return result.filter((rule) => !rule.isAllowlist());
    }

    /**
     * Checks if a scriptlet is allowlisted for a request. It looks up the scriptlet by name in the
     * allowlistScriptlets map and evaluates two conditions:
     * 1. If there's a generic allowlist rule applicable to all sites.
     * 2. If there's a specific allowlist rule that matches the request.
     *
     * @param name Name of the scriptlet. `null` searches for scriptlets allowlisted globally.
     * @param request Request details to match against allowlist rules.
     * @returns True if allowlisted by a matching rule or a generic rule. False otherwise.
     */
    isScriptletAllowlistedByName = (name: string | null, request: Request) => {
        // check for rules with names
        const allowlistScriptletRulesIndexes = this.allowlistScriptlets.get(name);
        if (allowlistScriptletRulesIndexes) {
            const rules = allowlistScriptletRulesIndexes
                .map((i) => {
                    return this.ruleStorage.retrieveRule(i) as CosmeticRule;
                })
                .filter((r) => r);
            // here we check if there is at least one generic allowlist rule
            const hasAllowlistGenericScriptlet = rules.some((r) => {
                return r.isGeneric();
            });
            if (hasAllowlistGenericScriptlet) {
                return true;
            }
            // here we check if there is at least one allowlist rule that matches the request
            const hasRuleMatchingRequest = rules.some((r) => r.match(request));
            if (hasRuleMatchingRequest) {
                return true;
            }
        }
        return false;
    };

    /**
     * Checks if the rule is disabled on the specified hostname.
     * @param request
     * @param rule
     */
    isAllowlisted(request: Request, rule: CosmeticRule): boolean {
        if (rule.scriptletOptions) {
            // null is a special case for scriptlet when the allowlist scriptlet has no name
            // e.g. #@%#//scriptlet(); example.org#@%#//scriptlet();
            if (this.isScriptletAllowlistedByName(null, request)) {
                return true;
            }

            if (this.isScriptletAllowlistedByName(rule.scriptletOptions.name, request)) {
                return true;
            }
        }

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
