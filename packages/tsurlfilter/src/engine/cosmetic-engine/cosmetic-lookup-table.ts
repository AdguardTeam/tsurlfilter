import { parse } from 'tldts';

import { type RuleStorage } from '../../filterlist/rule-storage';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { type Request } from '../../request';
import { type CosmeticRule } from '../../rules/cosmetic-rule';
import { fastHash } from '../../utils/string-utils';

/**
 * @typedef {import('./cosmetic-engine').CosmeticEngine} CosmeticEngine
 */

/**
 * CosmeticLookupTable lets quickly lookup cosmetic rules for the specified hostname.
 * It is primarily used by the {@link CosmeticEngine}.
 */
export class CosmeticLookupTable {
    /**
     * Map with rules indices grouped by the permitted domains names.
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
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#element-hiding-rules-exceptions}
     */
    private allowlist: Map<string, number[]>;

    /**
     * Storage for the filtering rules.
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Creates a new instance.
     *
     * @param storage Rules storage. We store "rule indexes" in the lookup table which
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
     * Adds rule to the allowlist map.
     *
     * @param key Can be used any string, but here we use ruleContent, scriptlet content, or scriptlet name.
     * @param storageIdx Index of the rule.
     */
    public addAllowlistRule(key: string, storageIdx: number): void {
        const existingRules = this.allowlist.get(key);
        if (!existingRules) {
            this.allowlist.set(key, [storageIdx]);
            return;
        }
        existingRules.push(storageIdx);
    }

    /**
     * Adds rule to the appropriate collection.
     *
     * @param rule Rule to add.
     * @param storageIdx Index of the rule in the storage.
     */
    public addRule(rule: CosmeticRule, storageIdx: number): void {
        if (rule.isAllowlist()) {
            if (rule.isScriptlet) {
                // Store scriptlet rules by name to enable the possibility of allowlisting them.
                // See https://github.com/AdguardTeam/Scriptlets/issues/377 for more details.
                if (rule.scriptletParams.name !== undefined
                    && rule.scriptletParams.args.length === 0) {
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
     * Finds rules by hostname.
     *
     * @param request Request to check.
     *
     * @returns Array of matching cosmetic rules.
     */
    public findByHostname(request: Request): CosmeticRule[] {
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
     * Checks if a scriptlet is allowlisted for a request. It looks up the scriptlet
     * by content in the allowlist map and evaluates two conditions:
     * 1. If there's a generic allowlist rule applicable to all sites.
     * 2. If there's a specific allowlist rule that matches the request.
     *
     * @param content Content of the scriptlet. Empty string '' searches for scriptlets allowlisted globally.
     * @param request Request details to match against allowlist rules.
     *
     * @returns True if allowlisted by a matching rule or a generic rule. False otherwise.
     */
    isScriptletAllowlisted = (content: string, request: Request) => {
        // check for rules with that content
        const allowlistScriptletRulesIndexes = this.allowlist.get(content);
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
     *
     * @param request Request to check.
     * @param rule Rule to check.
     *
     * @returns True if the rule is disabled on the specified hostname.
     */
    public isAllowlisted(request: Request, rule: CosmeticRule): boolean {
        if (rule.isScriptlet) {
            // Empty string '' is a special case for scriptlet when the allowlist scriptlet has no name
            // e.g. #@%#//scriptlet(); example.org#@%#//scriptlet();
            const EMPTY_SCRIPTLET_NAME = '';
            if (this.isScriptletAllowlisted(EMPTY_SCRIPTLET_NAME, request)) {
                return true;
            }

            // If scriptlet allowlisted by name
            // e.g. #@%#//scriptlet('set-cookie'); example.org#@%#//scriptlet('set-cookie');
            if (rule.scriptletParams.name !== undefined
                && this.isScriptletAllowlisted(rule.scriptletParams.name, request)) {
                return true;
            }

            // If scriptlet allowlisted with args, using normalized scriptlet content for better matching
            // on different quote types (see https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2947)
            // e.g. #@%#//scriptlet("set-cookie", "arg1"); example.org#@%#//scriptlet('set-cookie', 'arg1');
            if (rule.scriptletParams.name !== undefined
                && rule.scriptletParams.args.length > 0
                && this.isScriptletAllowlisted(rule.scriptletParams.toString(), request)) {
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
