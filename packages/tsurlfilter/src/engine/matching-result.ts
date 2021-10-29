import { NetworkRule, NetworkRuleOption } from '../rules/network-rule';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { CosmeticOption } from './cosmetic-option';
import { RedirectModifier } from '../modifiers/redirect-modifier';

/**
 * MatchingResult contains all the rules matching a web request, and provides methods
 * that define how a web request should be processed
 */
export class MatchingResult {
    /**
     * BasicRule - a rule matching the request.
     * It could lead to one of the following:
     * block the request
     * unblock the request (a regular allowlist rule or a document-level allowlist rule)
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
     * ReplaceRules - a set of rules modifying the response's content
     * See $replace modifier
     */
    public readonly replaceRules: NetworkRule[] | null;

    /**
     * Redirect rules - a set of rules redirecting request
     * See $redirect modifier
     */
    public readonly redirectRules: NetworkRule[] | null;

    /**
     * RemoveParam rules - a set of rules modifying url query parameters
     * See $removeparam modifier
     */
    public readonly removeParamRules: NetworkRule[] | null;

    /**
     * RemoveHeader rules - a set of rules modifying headers
     * See $removeheader modifier
     */
    public readonly removeHeaderRules: NetworkRule[] | null;

    /**
     * StealthRule - this is a allowlist rule that negates stealth mode features
     * Note that the stealth rule can be be received from both rules and sourceRules
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#stealth-modifier
     */
    public stealthRule: NetworkRule | null;

    /**
     * Creates an instance of the MatchingResult struct and fills it with the rules.
     *
     * @param rules network rules
     * @param sourceRule source rule
     */
    constructor(rules: NetworkRule[], sourceRule: NetworkRule | null) {
        this.basicRule = null;
        this.documentRule = null;
        this.cspRules = null;
        this.cookieRules = null;
        this.replaceRules = null;
        this.removeParamRules = null;
        this.removeHeaderRules = null;
        this.redirectRules = null;
        this.cspRules = null;
        this.stealthRule = null;

        // eslint-disable-next-line no-param-reassign
        rules = MatchingResult.removeBadfilterRules(rules);

        if (sourceRule) {
            this.documentRule = sourceRule;
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
            if (rule.isOptionEnabled(NetworkRuleOption.RemoveParam)) {
                if (!this.removeParamRules) {
                    this.removeParamRules = [];
                }
                this.removeParamRules.push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.RemoveHeader)) {
                if (!this.removeHeaderRules) {
                    this.removeHeaderRules = [];
                }
                this.removeHeaderRules.push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
                if (!this.redirectRules) {
                    this.redirectRules = [];
                }
                this.redirectRules.push(rule);
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
                continue;
            }

            // Check blocking rules against $genericblock / $urlblock
            if (!rule.isAllowlist()) {
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
     * returns a allowlist rule -- bypass the request.
     * returns a blocking rule -- block the request.
     *
     * @return {NetworkRule | null} basic result rule
     */
    getBasicResult(): NetworkRule | null {
        let basic = this.basicRule;
        if (!basic) {
            // Only document-level frame rule would be returned as a basic result,
            // cause only those rules could block or modify page subrequests.
            // Other frame rules (generichide, elemhide etc) will be used in getCosmeticOption function.
            if (this.documentRule && this.documentRule.isDocumentLevelAllowlistRule()) {
                basic = this.documentRule;
            }
        }

        // https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#replace-modifier
        // 1. $replace rules have a higher priority than other basic rules (including exception rules).
        //  So if a request corresponds to two different rules one of which has the $replace modifier,
        //  this rule will be applied.
        // 2. $document exception rules and rules with $content or $replace modifiers do disable $replace rules
        //  for requests matching them.
        if (this.replaceRules) {
            if (basic && basic.isAllowlist()) {
                if (basic.isDocumentAllowlistRule()) {
                    return basic;
                }

                if (basic.isOptionEnabled(NetworkRuleOption.Replace)
                    || basic.isOptionEnabled(NetworkRuleOption.Content)) {
                    return basic;
                }
            }

            return null;
        }

        // https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#redirect-modifier
        // Redirect rules have a high priority
        const redirectRule = this.getRedirectRule();
        if (redirectRule) {
            if (!basic || redirectRule.isHigherPriority(basic)) {
                return redirectRule;
            }
        }

        return basic;
    }

    /**
     * Returns a bit-flag with the list of cosmetic options
     *
     * @return {CosmeticOption} mask
     */
    getCosmeticOption(): CosmeticOption {
        if (!this.basicRule || !this.basicRule.isAllowlist()) {
            return CosmeticOption.CosmeticOptionAll;
        }

        if (this.basicRule.isDocumentAllowlistRule()) {
            return CosmeticOption.CosmeticOptionNone;
        }

        let option = CosmeticOption.CosmeticOptionAll;

        if (this.basicRule.isOptionEnabled(NetworkRuleOption.Elemhide)) {
            option ^= CosmeticOption.CosmeticOptionGenericCSS;
            option ^= CosmeticOption.CosmeticOptionSpecificCSS;
        }

        if (this.basicRule.isOptionEnabled(NetworkRuleOption.Generichide)) {
            option ^= CosmeticOption.CosmeticOptionGenericCSS;
        }

        if (this.basicRule.isOptionEnabled(NetworkRuleOption.Specifichide)) {
            option ^= CosmeticOption.CosmeticOptionSpecificCSS;
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

        // TODO: Look up for allowlist $content rule

        return MatchingResult.filterAdvancedModifierRules(this.replaceRules,
            (rule) => ((x): boolean => x.getAdvancedModifierValue() === rule.getAdvancedModifierValue()));
    }

    /**
     * Filters array of rules according to allowlist rules contained.
     * Empty advanced modifier allowlists everything.
     *
     * @param rules
     * @param allowlistPredicate allowlist criteria
     * This function result will be called for testing if rule `x` allowlists rule `r`
     */
    private static filterAdvancedModifierRules(
        rules: NetworkRule[], allowlistPredicate: (r: NetworkRule) => ((x: NetworkRule) => boolean),
    ): NetworkRule[] {
        const blockingRules: NetworkRule[] = [];
        const allowlistRules: NetworkRule[] = [];

        for (const rule of rules) {
            if (rule.isAllowlist()) {
                allowlistRules.push(rule);
            } else {
                blockingRules.push(rule);
            }
        }

        if (blockingRules.length === 0) {
            return [];
        }

        if (allowlistRules.length === 0) {
            return blockingRules;
        }

        if (allowlistRules.length > 0) {
            const allowlistRuleWithEmptyOption = allowlistRules
                .find((allowlistRule) => allowlistRule.getAdvancedModifierValue() === '');

            const result: NetworkRule[] = [];
            blockingRules.forEach((blockRule) => {
                if (allowlistRuleWithEmptyOption
                    && !blockRule.isHigherPriority(allowlistRuleWithEmptyOption)) {
                    result.push(allowlistRuleWithEmptyOption);
                    return;
                }

                const allowlistingRule = allowlistRules.find((a) => {
                    return !blockRule.isHigherPriority(a) && allowlistPredicate.call(this, blockRule)(a);
                });

                if (allowlistingRule) {
                    result.push(allowlistingRule);
                } else {
                    result.push(blockRule);
                }
            });

            return result.filter((item, pos) => result.indexOf(item) == pos);
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
        const allowlistedRulesByDirective = new Map<string, NetworkRule>();

        for (const rule of this.cspRules) {
            if (rule.isAllowlist()) {
                if (!rule.getAdvancedModifierValue()) { // Global allowlist rule
                    return [rule];
                }

                MatchingResult.putWithPriority(rule, undefined, allowlistedRulesByDirective);
            } else {
                blockingRules.push(rule);
            }
        }

        const rulesByDirective = new Map<string, NetworkRule>();

        // Collect allowlist and blocking CSP rules in one array
        blockingRules.forEach((rule) => {
            if (rule.getAdvancedModifierValue()) {
                const allowlistRule = allowlistedRulesByDirective.get(rule.getAdvancedModifierValue()!);
                MatchingResult.putWithPriority(rule, allowlistRule, rulesByDirective);
            }
        });

        return Array.from(rulesByDirective.values());
    }

    /**
     * Returns a redirect rule
     */
    getRedirectRule(): NetworkRule | null {
        if (!this.redirectRules) {
            return null;
        }

        let result = MatchingResult.filterAdvancedModifierRules(this.redirectRules,
            (rule) => ((x): boolean => x.getAdvancedModifierValue() === rule.getAdvancedModifierValue()));

        result = result.filter((r) => !r.isAllowlist());

        const conditionalRedirectRules = result.filter((x) => {
            const redirectModifier = x.getAdvancedModifier() as RedirectModifier;
            return redirectModifier.isRedirectingOnlyBlocked;
        });
        const allWeatherRedirectRules = result.filter((x) => !conditionalRedirectRules.includes(x));

        if (allWeatherRedirectRules.length > 0) {
            return allWeatherRedirectRules.sort(
                (a, b) => (b.isOptionEnabled(NetworkRuleOption.Important)
                        && !a.isOptionEnabled(NetworkRuleOption.Important) ? 1 : -1),
            )[0];
        }

        if (conditionalRedirectRules.length === 0) {
            return null;
        }

        const resultRule = conditionalRedirectRules.sort(
            (a, b) => (b.isOptionEnabled(NetworkRuleOption.Important)
                        && !a.isOptionEnabled(NetworkRuleOption.Important) ? 1 : -1),
        )[0];
        const redirectModifier = resultRule.getAdvancedModifier() as RedirectModifier;
        if (redirectModifier && redirectModifier.isRedirectingOnlyBlocked) {
            if (!(this.basicRule && !this.basicRule.isAllowlist())) {
                return null;
            }
        }

        return resultRule;
    }

    /**
     * Returns an array of cookie rules
     */
    getCookieRules(): NetworkRule[] {
        if (!this.cookieRules) {
            return [];
        }

        const basic = this.getBasicResult();
        if (basic?.isDocumentAllowlistRule()) {
            return [];
        }

        const allowlistPredicate = (rule: NetworkRule) => (
            (allowlistRule: NetworkRule): boolean => {
                const allowlistRuleCookieModifier = allowlistRule.getAdvancedModifier() as CookieModifier;
                const ruleCookieModifier = rule.getAdvancedModifier() as CookieModifier;

                if (allowlistRule.getAdvancedModifierValue() === rule.getAdvancedModifierValue()) {
                    return true;
                }

                // Matches by cookie name
                if (allowlistRuleCookieModifier.matches(ruleCookieModifier.getCookieName())) {
                    return true;
                }

                return false;
            }
        );

        const filtered = MatchingResult.filterAdvancedModifierRules(this.cookieRules, allowlistPredicate);
        return filtered.concat([...this.cookieRules.filter((r) => r.isAllowlist())] );
    }

    /**
     * Returns an array of removeparam rules
     */
    getRemoveParamRules(): NetworkRule[] {
        if (!this.removeParamRules) {
            return [];
        }

        return MatchingResult.filterAdvancedModifierRules(this.removeParamRules,
            // eslint-disable-next-line arrow-body-style
            (rule) => ((x): boolean => {
                return x.isHigherPriority(rule) && x.getAdvancedModifierValue() === rule.getAdvancedModifierValue();
            }));
    }

    /**
     * Returns an array of removeheader rules
     */
    getRemoveHeaderRules(): NetworkRule[] {
        if (!this.removeHeaderRules) {
            return [];
        }

        if (this.basicRule
            && this.basicRule.isAllowlist()
            && this.basicRule.isOptionEnabled(NetworkRuleOption.Urlblock)) {
            return [];
        }

        return MatchingResult.filterAdvancedModifierRules(this.removeHeaderRules,
            (rule) => ((x): boolean => x.getAdvancedModifierValue() === rule.getAdvancedModifierValue()));
    }

    /**
     * Decides which rule should be put into the given map.
     * Compares priorities of the two given rules with the equal CSP directive and the rule that may already in the map.
     *
     * @param rule CSP rule (not null)
     * @param allowlistRule CSP allowlist rule (may be null)
     * @param map Rules mapped by csp directive
     */
    // eslint-disable-next-line max-len
    private static putWithPriority(rule: NetworkRule, allowlistRule: NetworkRule | undefined, map: Map<string, NetworkRule>): void {
        const cspDirective = rule.getAdvancedModifierValue();
        const currentRule = cspDirective ? map.get(cspDirective) : null;

        let newRule = rule;
        if (currentRule && !rule.isHigherPriority(currentRule)) {
            newRule = currentRule;
        }

        if (allowlistRule && allowlistRule.isHigherPriority(newRule)) {
            newRule = allowlistRule;
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
    static removeBadfilterRules(rules: NetworkRule[]): NetworkRule[] {
        const badfilterRules: NetworkRule[] = [];
        for (const rule of rules) {
            if (rule.isOptionEnabled(NetworkRuleOption.Badfilter)) {
                badfilterRules.push(rule);
            }
        }

        if (badfilterRules.length > 0) {
            return rules.filter((rule) => {
                if (rule.isOptionEnabled(NetworkRuleOption.Badfilter)) {
                    return false;
                }

                const isRuleNegated = badfilterRules.some((badfilter) => badfilter.negatesBadfilter(rule));

                return !isRuleNegated;
            });
        }

        return rules;
    }
}
