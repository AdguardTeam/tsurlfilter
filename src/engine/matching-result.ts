import { NetworkRule, NetworkRuleOption } from '../rules/network-rule';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { CosmeticOption } from './cosmetic-option';

/**
 * MatchingResult contains all the rules matching a web request, and provides methods
 * that define how a web request should be processed
 */
export class MatchingResult {
    /**
     * BasicRule - a rule matching the request.
     * It could lead to one of the following:
     * block the request
     * unblock the request (a regular whitelist rule or a document-level whitelist rule)
     * modify the way cosmetic rules work for this request
     * modify the response (see $redirect rules)
     */
    public readonly basicRule: NetworkRule | null;

    /**
     * DocumentRule - a rule matching the request's referrer and having on of the following modifiers:
     * $document -- this one basically disables everything
     * $urlblock -- disables network-level rules (not cosmetic)
     * $genericblock -- disables generic network-level rules

     * Other document-level modifiers like $jsinject or $content will be ignored here as they don't do anything
     */
    public documentRule: NetworkRule | null;

    /**
     * CspRules - a set of rules modifying the response's content-security-policy
     * See $csp modifier
     */
    public readonly cspRules: NetworkRule[] | null;

    /**
     * CookieRules - a set of rules modifying the request's and response's cookies
     * See $cookie modifier
     */
    public readonly cookieRules: NetworkRule[] | null;

    /**
     * ReplaceRules -- a set of rules modifying the response's content
     * See $replace modifier
     */
    public readonly replaceRules: NetworkRule[] | null;

    /**
     * StealthRule - this is a whitelist rule that negates stealth mode features
     * Note that the stealth rule can be be received from both rules and sourceRules
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#stealth-modifier
     */
    public stealthRule: NetworkRule | null;

    /**
     * Creates an instance of the MatchingResult struct and fills it with the rules.
     *
     * @param rules network rules
     * @param sourceRules source rules
     */
    constructor(rules: NetworkRule[], sourceRules: NetworkRule[] | null) {
        this.basicRule = null;
        this.documentRule = null;
        this.cspRules = null;
        this.cookieRules = null;
        this.replaceRules = null;
        this.cspRules = null;
        this.stealthRule = null;

        // eslint-disable-next-line no-param-reassign
        rules = MatchingResult.removeBadfilterRules(rules);
        if (sourceRules) {
            // eslint-disable-next-line no-param-reassign
            sourceRules = MatchingResult.removeBadfilterRules(sourceRules);
        }

        // First of all, find document-level whitelist rules
        if (sourceRules) {
            sourceRules.forEach((r) => {
                if (r.isDocumentWhitelistRule()) {
                    if (!this.documentRule || r.isHigherPriority(this.documentRule)) {
                        this.documentRule = r;
                    }
                }

                if (r.isOptionEnabled(NetworkRuleOption.Stealth)) {
                    this.stealthRule = r;
                }
            });
        }

        // Second - check if blocking rules (generic or all of them) are allowed
        // generic blocking rules are allowed by default
        let genericAllowed = true;
        // basic blocking rules are allowed by default
        let basicAllowed = true;
        if (this.documentRule) {
            const documentRule = this.documentRule as NetworkRule;
            if (documentRule.isOptionEnabled(NetworkRuleOption.Urlblock)) {
                basicAllowed = false;
            } else if (documentRule.isOptionEnabled(NetworkRuleOption.Genericblock)) {
                genericAllowed = false;
            }
        }

        // Iterate through the list of rules and fill the MatchingResult
        for (const rule of rules) {
            if (rule.isOptionEnabled(NetworkRuleOption.Cookie)) {
                if (!this.cookieRules) {
                    this.cookieRules = [];
                }
                this.cookieRules.push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Replace)) {
                if (!this.replaceRules) {
                    this.replaceRules = [];
                }
                this.replaceRules.push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Csp)) {
                if (!this.cspRules) {
                    this.cspRules = [];
                }
                this.cspRules.push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Stealth)) {
                this.stealthRule = rule;
            }

            // Check blocking rules against $genericblock / $urlblock
            if (!rule.isWhitelist()) {
                if (!basicAllowed) {
                    continue;
                }
                if (!genericAllowed && rule.isGeneric()) {
                    continue;
                }
            }

            if (!this.basicRule || rule.isHigherPriority(this.basicRule)) {
                this.basicRule = rule;
            }
        }
    }

    /**
     * GetBasicResult returns a rule that should be applied to the web request.
     * Possible outcomes are:
     * returns nil -- bypass the request.
     * returns a whitelist rule -- bypass the request.
     * returns a blocking rule -- block the request.
     *
     * @return {NetworkRule | null} basic result rule
     */
    getBasicResult(): NetworkRule | null {
        // https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#replace-modifier
        // 1. $replace rules have a higher priority than other basic rules (including exception rules).
        //  So if a request corresponds to two different rules one of which has the $replace modifier,
        //  this rule will be applied.
        // 2. Document-level exception rules with $content or $document modifiers do disable $replace rules
        //  for requests matching them.
        if (this.replaceRules) {
            // TODO: implement the $replace selection algorithm
            // 1. check that ReplaceRules aren't negated by themselves (for instance,
            //  that there's no @@||example.org^$replace rule)
            // 2. check that they aren't disabled by a document-level exception (check both DocumentRule and BasicRule)
            // 3. return nil if that is so
            return null;
        }

        if (!this.basicRule) {
            return this.documentRule;
        }

        return this.basicRule;
    }

    /**
     * Returns a bit-flag with the list of cosmetic options
     *
     * @return {CosmeticOption} mask
     */
    getCosmeticOption(): CosmeticOption {
        if (!this.basicRule || !this.basicRule.isWhitelist()) {
            return CosmeticOption.CosmeticOptionAll;
        }

        if (this.basicRule.isDocumentWhitelistRule()) {
            return CosmeticOption.CosmeticOptionNone;
        }

        let option = CosmeticOption.CosmeticOptionAll;

        if (this.basicRule.isOptionEnabled(NetworkRuleOption.Elemhide)) {
            option ^= CosmeticOption.CosmeticOptionCSS;
            option ^= CosmeticOption.CosmeticOptionGenericCSS;
        }

        if (this.basicRule.isOptionEnabled(NetworkRuleOption.Generichide)) {
            option ^= CosmeticOption.CosmeticOptionGenericCSS;
        }

        if (this.basicRule.isOptionEnabled(NetworkRuleOption.Jsinject)) {
            option ^= CosmeticOption.CosmeticOptionJS;
        }

        if (this.basicRule.isOptionEnabled(NetworkRuleOption.Content)) {
            option ^= CosmeticOption.CosmeticOptionHtml;
        }

        return option;
    }

    /**
     * Return an array of replace rules
     */
    getReplaceRules(): NetworkRule[] {
        if (!this.replaceRules) {
            return [];
        }

        return MatchingResult.filterAdvancedModifierRules(this.replaceRules,
            (rule) => ((x): boolean => x.getAdvancedModifierValue() === rule.getAdvancedModifierValue()));
    }

    /**
     * Filters array of rules according to whitelist rules contained.
     * Empty advanced modifier whitelists everything.
     *
     * @param rules
     * @param whitelistPredicate whitelist criteria
     * This function result will be called for testing if rule `x` whitelists rule `r`
     */
    private static filterAdvancedModifierRules(
        rules: NetworkRule[], whitelistPredicate: (r: NetworkRule) => ((x: NetworkRule) => boolean),
    ): NetworkRule[] {
        const blockingRules: NetworkRule[] = [];
        const whitelistRules: NetworkRule[] = [];

        for (const rule of rules) {
            if (rule.isWhitelist()) {
                whitelistRules.push(rule);
            } else {
                blockingRules.push(rule);
            }
        }

        if (blockingRules.length === 0) {
            return [];
        }

        if (whitelistRules.length === 0) {
            return blockingRules;
        }

        if (whitelistRules.length > 0) {
            const whiteRuleWithEmptyOptionText = whitelistRules
                .find((whiteRule) => whiteRule.getAdvancedModifierValue() === '');

            // @@||example.org^$replace will disable all $replace rules matching ||example.org^.
            if (whiteRuleWithEmptyOptionText) {
                return [whiteRuleWithEmptyOptionText];
            }

            const foundReplaceRules: NetworkRule[] = [];
            blockingRules.forEach((blockRule) => {
                const whitelistingRule = whitelistRules.find(whitelistPredicate(blockRule));
                if (whitelistingRule) {
                    foundReplaceRules.push(whitelistingRule);
                } else {
                    foundReplaceRules.push(blockRule);
                }
            });

            return foundReplaceRules;
        }

        return blockingRules;
    }

    /**
     * Returns an array of csp rules
     */
    getCspRules(): NetworkRule[] {
        if (!this.cspRules) {
            return [];
        }

        const blockingRules: NetworkRule[] = [];
        const whitelistedRulesByDirective = new Map<string, NetworkRule>();

        for (const rule of this.cspRules) {
            if (rule.isWhitelist()) {
                if (!rule.getAdvancedModifierValue()) { // Global whitelist rule
                    return [rule];
                }

                MatchingResult.putWithPriority(rule, undefined, whitelistedRulesByDirective);
            } else {
                blockingRules.push(rule);
            }
        }

        const rulesByDirective = new Map<string, NetworkRule>();

        // Collect whitelist and blocking CSP rules in one array
        blockingRules.forEach((rule) => {
            if (rule.getAdvancedModifierValue()) {
                const whiteListRule = whitelistedRulesByDirective.get(rule.getAdvancedModifierValue()!);
                MatchingResult.putWithPriority(rule, whiteListRule, rulesByDirective);
            }
        });

        return Array.from(rulesByDirective.values());
    }

    /**
     * Returns an array of cookie rules
     */
    getCookieRules(): NetworkRule[] {
        if (!this.cookieRules) {
            return [];
        }

        const whitelistPredicate = (rule: NetworkRule) => (
            (whiteRule: NetworkRule): boolean => {
                const whiteRuleCookieModifier = whiteRule.getAdvancedModifier() as CookieModifier;
                const ruleCookieModifier = rule.getAdvancedModifier() as CookieModifier;

                if (whiteRule.getAdvancedModifierValue() === rule.getAdvancedModifierValue()) {
                    return true;
                }

                // Matches by cookie name
                if (whiteRuleCookieModifier.matches(ruleCookieModifier.getCookieName())) {
                    return true;
                }

                return false;
            }
        );

        return MatchingResult.filterAdvancedModifierRules(this.cookieRules,
            whitelistPredicate);
    }

    /**
     * Decides which rule should be put into the given map.
     * Compares priorities of the two given rules with the equal CSP directive and the rule that may already in the map.
     *
     * @param rule CSP rule (not null)
     * @param whiteListRule CSP whitelist rule (may be null)
     * @param map Rules mapped by csp directive
     */
    // eslint-disable-next-line max-len
    private static putWithPriority(rule: NetworkRule, whiteListRule: NetworkRule | undefined, map: Map<string, NetworkRule>): void {
        const cspDirective = rule.getAdvancedModifierValue();
        const currentRule = cspDirective ? map.get(cspDirective) : null;

        let newRule = rule;
        if (currentRule && !rule.isHigherPriority(currentRule)) {
            newRule = currentRule;
        }

        if (whiteListRule && whiteListRule.isHigherPriority(newRule)) {
            newRule = whiteListRule;
        }

        map.set(cspDirective!, newRule);
    }

    /**
     * Looks if there are any matching $badfilter rules and removes
     * matching bad filters from the array (see the $badfilter description for more info)
     *
     * @param rules to filter
     * @return filtered rules
     */
    private static removeBadfilterRules(rules: NetworkRule[]): NetworkRule[] {
        const badfilterRules: NetworkRule[] = [];
        for (const rule of rules) {
            if (rule.isOptionEnabled(NetworkRuleOption.Badfilter)) {
                badfilterRules.push(rule);
            }
        }

        if (badfilterRules.length > 0) {
            const filteredRules: NetworkRule[] = [];
            for (const badfilter of badfilterRules) {
                for (const rule of rules) {
                    if (!rule.isOptionEnabled(NetworkRuleOption.Badfilter)) {
                        if (!badfilter.negatesBadfilter(rule)) {
                            filteredRules.push(rule);
                        }
                    }
                }
            }

            return filteredRules;
        }

        return rules;
    }
}
