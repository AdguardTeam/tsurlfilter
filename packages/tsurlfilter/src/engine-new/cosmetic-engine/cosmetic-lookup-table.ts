import { ADG_SCRIPTLET_MASK, QuoteType, QuoteUtils } from '@adguard/agtree';
import { parse } from 'tldts';

import { type CosmeticRuleParts, CosmeticRuleType } from '../../filterlist/rule-parts';
import { type RuleStorage } from '../../filterlist/rule-storage-new';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { type Request } from '../../request';
import { type CosmeticRule } from '../../rules/cosmetic-rule';
import { CachedFastHash } from '../cached-fast-hash';

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
     * Generic rules essentially works on all websites, unless a specific exception rule is defined for them.
     */
    public genericRules: CosmeticRule[];

    /**
     * Map with allowlist rules indices. Key is the rule content.
     * Values are rule indexes.
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
        this.seqScanRules = [];
        this.genericRules = [];
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
     * Checks if the rule is a scriptlet rule.
     *
     * @param rule Rule to check.
     *
     * @returns True if the rule is a scriptlet rule.
     */
    private static isScriptletRule(rule: CosmeticRuleParts): boolean {
        return rule.type === CosmeticRuleType.JsInjectionRule
            && rule.text.startsWith(`${ADG_SCRIPTLET_MASK}(`, rule.contentStart)
            && rule.text.endsWith(')', rule.contentEnd);
    }

    /**
     * Adds rule to the appropriate collection.
     *
     * @param rule Rule to add.
     * @param storageIdx Index of the rule in the storage.
     */
    public addRule(rule: CosmeticRuleParts, storageIdx: number): void {
        if (rule.allowlist) {
            if (!CosmeticLookupTable.isScriptletRule(rule)) {
                // Store all non-scriptlet rules by their content.
                this.addAllowlistRule(rule.text.slice(rule.contentStart, rule.contentEnd), storageIdx);
            }

            /*
             * Get scriptlet name and arguments (if any).
             * For example:
             * - //scriptlet('log', 'arg') -> ['log', 'arg']
             * - //scriptlet('')           -> ['']
             * - //scriptlet()             -> ['']
             */
            const params = rule.text
                .slice(
                    // +1 to skip the space after the scriptlet mask
                    rule.contentStart + ADG_SCRIPTLET_MASK.length + 1,
                    // -1 to skip the closing parenthesis
                    rule.contentEnd - 1,
                )
                .split(',')
                .map((p) => QuoteUtils.removeQuotesAndUnescape(p.trim()));

            /*
             * If only one parameter is specified, it means only scriptlet name is specified.
             * In this case we can allowlist scriptlet by name. For example:
             * - #@%#//scriptlet('set-cookie')
             * Also, there are two special cases here:
             * - #@%#//scriptlet('')
             * - #@%#//scriptlet()
             * See https://github.com/AdguardTeam/Scriptlets/issues/377 for more details.
             */
            if (params[0] !== undefined && params.length === 1) {
                this.addAllowlistRule(params[0], storageIdx);
                return;
            }

            /*
             * If more than one parameter is specified, it means scriptlet name and arguments are specified.
             * In this case we can allowlist scriptlet by content. For example:
             * - #@%#//scriptlet('log', 'arg')
             * But we should use normalized scriptlet content for better matching.
             * For example, //scriptlet('log', 'arg') can be matched by //scriptlet("log", "arg").
             * In other words, here we normalize //scriptlet("log", "arg") to //scriptlet('log', 'arg').
             */
            this.addAllowlistRule(
                // FIXME (David): maybe move ScriptletParams from cosmetic-rule.ts to a common file
                // and reuse it here
                // eslint-disable-next-line max-len
                `${ADG_SCRIPTLET_MASK}(${params.map((p) => QuoteUtils.setStringQuoteType(p, QuoteType.Single)).join(', ')})`,
                storageIdx,
            );

            return;
        }

        if (rule.domainsStart === undefined || rule.domainsEnd === undefined) {
            const cosmeticRule = this.ruleStorage.retrieveCosmeticRule(storageIdx);
            if (cosmeticRule) {
                this.genericRules.push(cosmeticRule);
            }
            return;
        }

        const domains = rule.text
            .slice(rule.domainsStart, rule.domainsEnd)
            .split(',')
            .map((d) => d.trim());

        if (!domains.length || domains.every((d) => d.startsWith('~'))) {
            const cosmeticRule = this.ruleStorage.retrieveCosmeticRule(storageIdx);
            if (cosmeticRule) {
                this.genericRules.push(cosmeticRule);
            }
            return;
        }

        if (domains.some(DomainModifier.isWildcardOrRegexDomain)) {
            const cosmeticRule = this.ruleStorage.retrieveCosmeticRule(storageIdx);
            if (cosmeticRule) {
                this.seqScanRules.push(cosmeticRule);
            }
            return;
        }

        for (const domain of domains) {
            const tldResult = parse(domain);
            // tldResult.domain equals to eTLD domain,
            // e.g. sub.example.uk.org would result in example.uk.org
            const parsedDomain = tldResult.domain || domain;
            const key = CachedFastHash.get(parsedDomain);
            const rules: number[] = this.byHostname.get(key) || [];
            rules.push(storageIdx);
            this.byHostname.set(key, rules);
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
        const result: CosmeticRule[] = [];
        const { subdomains } = request;

        for (let i = 0; i < subdomains.length; i += 1) {
            const subdomain = subdomains[i];
            const rulesIndexes = this.byHostname.get(CachedFastHash.get(subdomain));

            if (!rulesIndexes || rulesIndexes.length === 0) {
                continue;
            }

            // FIXME (David): Double check, is it helps, if we handle 1-lenght case separately
            const uniqueRulesIndexes = new Set(rulesIndexes);
            for (const ruleIndex of uniqueRulesIndexes) {
                const rule = this.ruleStorage.retrieveRule(ruleIndex) as CosmeticRule;
                if (rule && !rule.isAllowlist() && rule.match(request)) {
                    result.push(rule);
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
                .map((i) => this.ruleStorage.retrieveCosmeticRule(i))
                .filter((r): r is CosmeticRule => r !== null);

            // here we check if there is at least one generic allowlist rule
            const hasAllowlistGenericScriptlet = rules.some((r) => r.isGeneric());
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
