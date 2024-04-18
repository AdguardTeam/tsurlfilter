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
     * Adds rule to the allowlist map
     * @param key Can be used any string, but here we use ruleContent, scriptlet content, or scriptlet name.
     * @param storageIdx Index of the rule.
     */
    addAllowlistRule(key: string, storageIdx: number): void {
        const existingRules = this.allowlist.get(key);
        if (!existingRules) {
            this.allowlist.set(key, [storageIdx]);
            return;
        }
        existingRules.push(storageIdx);
    }

    /**
     * Adds rule to the appropriate collection
     * @param rule
     * @param storageIdx
     */
    addRule(rule: CosmeticRule, storageIdx: number): void {
        if (rule.isAllowlist()) {
            if (rule.isScriptlet) {
                // Store scriptlet rules by name to enable the possibility of allowlisting them.
                // See https://github.com/AdguardTeam/Scriptlets/issues/377 for more details.
                if (rule.scriptletParams.name !== undefined) {
                    this.addAllowlistRule(rule.scriptletParams.name, storageIdx);
                }
                // Use normalized scriptlet content for better matching.
                // For example, //scriptlet('log', 'arg') can be matched by //scriptlet("log", "arg").
                this.addAllowlistRule(rule.scriptletParams.toString(), storageIdx);
            } else {
                // Store all other rules by their content.
                this.addAllowlistRule(rule.getContent(), storageIdx);
            }
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
     * @param name Name of the scriptlet. Empty string '' searches for scriptlets allowlisted globally.
     * @param request Request details to match against allowlist rules.
     * @returns True if allowlisted by a matching rule or a generic rule. False otherwise.
     */
    isScriptletAllowlistedByName = (name: string, request: Request) => {
        // check for rules with names
        const allowlistScriptletRulesIndexes = this.allowlist.get(name);
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
        if (rule.isScriptlet) {
            // Empty string '' is a special case for scriptlet when the allowlist scriptlet has no name
            // e.g. #@%#//scriptlet(); example.org#@%#//scriptlet();
            const EMPTY_SCRIPTLET_NAME = '';
            if (this.isScriptletAllowlistedByName(EMPTY_SCRIPTLET_NAME, request)) {
                return true;
            }

            if (rule.scriptletParams.name !== undefined
                && this.isScriptletAllowlistedByName(rule.scriptletParams.name, request)) {
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
