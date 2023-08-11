import { NetworkRule, NetworkRuleOption } from '../rules/network-rule';
import { CookieModifier } from '../modifiers/cookie-modifier';
import { CosmeticOption } from './cosmetic-option';
import { RedirectModifier } from '../modifiers/redirect-modifier';
import { HttpHeadersItem } from '../modifiers/header-modifier';

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
     * See $redirect and $redirect-rule modifiers
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
     * Permissions rules - a set of rules modifying permissions policy
     * See $permissions modifier
     */
    public readonly permissionsRules: NetworkRule[] | null;

    /**
     * Headers rules - a set of rules for blocking rules by headers.
     */
    public readonly headerRules: NetworkRule[] | null;

    /**
     * StealthRule - this is a allowlist rule that negates stealth mode features
     * Note that the stealth rule can be be received from both rules and sourceRules
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#stealth-modifier
     */
    public stealthRule: NetworkRule | null;

    /**
     * Creates an instance of the MatchingResult struct and fills it with the rules.
     *
     * @param rules A list of network rules that match the request.
     * @param sourceRule A rule that matches the document that is a source
     * of the request, i.e. document-level exclusions.
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
        this.stealthRule = null;
        this.permissionsRules = null;
        this.headerRules = null;

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

            if (rule.isOptionEnabled(NetworkRuleOption.Permissions)) {
                if (!this.permissionsRules) {
                    this.permissionsRules = [];
                }
                this.permissionsRules.push(rule);
                continue;
            }

            if (rule.isOptionEnabled(NetworkRuleOption.Header)) {
                if (!this.headerRules) {
                    this.headerRules = [];
                }

                this.headerRules.push(rule);
                continue;
            }

            // Check blocking rules against $genericblock / $urlblock
            if (!rule.isAllowlist() && this.documentRule?.isHigherPriority(rule)) {
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
     * returns nil -- allow the request.
     * returns an allowlist rule -- allow the request.
     * returns a blocking rule -- block the request.
     * returns a redirect rule -- redirect the request.
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
        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-extra
        // $replace rules have a higher priority than other basic rules (including exception rules).
        // So if a request corresponds to two different rules one of which has the $replace modifier,
        // this rule will be applied.
        if (this.replaceRules) {
            const isReplaceOrContent = basic?.isOptionEnabled(NetworkRuleOption.Replace)
                || basic?.isOptionEnabled(NetworkRuleOption.Content);
            // If basic rule is an exception with $replace or $content modifier,
            // then basic rule will disable $replace rules.
            if (basic?.isAllowlist() && isReplaceOrContent) {
                return basic;
            }

            // Otherwise null is returned to allow the request, because we need
            // to get response first to then apply the $replace rules to
            // the response.
            return null;
        }

        // Redirect rules have a high priority
        // https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#redirect-modifier
        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#priority-category-6
        const redirectRule = this.getRedirectRule();
        if (redirectRule && (!basic || !basic.isHigherPriority(redirectRule))) {
            return redirectRule;
        }

        return basic;
    }

    /**
     * Returns a single rule with $header modifier,
     * that should be applied to the web request, if any.
     *
     * Function is intended to be called on onHeadersReceived event as an alternative to getBasicResult,
     * it returns only a blocking or allowlist rule without modifiers which could modify the request.
     * Request modifying rules with $header modifier are handled in a corresponding service.
     *
     * TODO: filterAdvancedModifierRules may not be optimal for sorting rules with $header modifier,
     * as $header is not an advanced modifier.
     *
     * @param responseHeaders response headers
     * @returns header result rule or null
     */
    getResponseHeadersResult(responseHeaders: HttpHeadersItem[] | undefined): NetworkRule | null {
        if (!responseHeaders || responseHeaders.length === 0) {
            return null;
        }

        const { basicRule, documentRule } = this;
        let { headerRules } = this;

        if (!headerRules) {
            return null;
        }

        if (!basicRule) {
            if (documentRule && documentRule.isDocumentLevelAllowlistRule()) {
                return null;
            }
        } else if (basicRule.isAllowlist()) {
            return null;
        }

        headerRules = headerRules.filter((rule) => rule.matchResponseHeaders(responseHeaders));

        // Handle allowlist rules with $header modifier,
        // filtering out blocking rules which are allowlisted
        const rules = MatchingResult.filterAdvancedModifierRules(
            headerRules,
            (bRule) => ((aRule): boolean => {
                const bHeaderData = bRule.getHeaderModifierValue();
                const aHeaderData = aRule.getHeaderModifierValue();
                return bHeaderData?.header === aHeaderData?.header
                    && bHeaderData?.value?.toString() === aHeaderData?.value?.toString();
            }),
        );

        return MatchingResult.getHighestPriorityRule(rules);
    }

    /**
     * Returns a bit-flag with the list of cosmetic options
     *
     * @return {CosmeticOption} mask
     */
    getCosmeticOption(): CosmeticOption {
        const { basicRule, documentRule } = this;

        let rule = basicRule;
        // We choose a non-empty rule and the one of the two with the higher
        // priority in order to accurately calculate cosmetic options.
        if ((!rule && documentRule) || (rule && documentRule?.isHigherPriority(rule))) {
            rule = documentRule;
        }

        if (!rule || !rule.isAllowlist()) {
            return CosmeticOption.CosmeticOptionAll;
        }

        let option = CosmeticOption.CosmeticOptionAll;

        if (rule.isOptionEnabled(NetworkRuleOption.Elemhide)) {
            option ^= CosmeticOption.CosmeticOptionGenericCSS;
            option ^= CosmeticOption.CosmeticOptionSpecificCSS;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Generichide)) {
            option ^= CosmeticOption.CosmeticOptionGenericCSS;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Specifichide)) {
            option ^= CosmeticOption.CosmeticOptionSpecificCSS;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Jsinject)) {
            option ^= CosmeticOption.CosmeticOptionJS;
        }

        if (rule.isOptionEnabled(NetworkRuleOption.Content)) {
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

        return MatchingResult.filterAdvancedModifierRules(
            this.replaceRules,
            (rule) => ((x): boolean => x.getAdvancedModifierValue() === rule.getAdvancedModifierValue()),
        );
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
        rules: NetworkRule[],
        allowlistPredicate: (r: NetworkRule) => ((x: NetworkRule) => boolean),
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

            return result.filter((item, pos) => result.indexOf(item) === pos);
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
     * Returns an array of permission policy rules
     */
    getPermissionsPolicyRules(): NetworkRule[] {
        if (!this.permissionsRules) {
            return [];
        }

        const permissionsRules: NetworkRule[] = [];

        for (const rule of this.permissionsRules) {
            if (rule.isAllowlist()) {
                /**
                 * Allowlist with $permissions modifier disables
                 * all the $permissions rules on all the pages matching the rule pattern.
                 */
                if (!rule.getAdvancedModifierValue()) {
                    return [rule];
                }
            } else {
                permissionsRules.push(rule);
            }
        }

        return permissionsRules;
    }

    /**
     * Returns a redirect rule or null if redirect rules are empty.
     * $redirect-rule is only returned if there's a blocking rule also matching
     * this request.
     */
    private getRedirectRule(): NetworkRule | null {
        if (!this.redirectRules) {
            return null;
        }

        // Apply allowlist $redirect rules.
        let result = MatchingResult.filterAdvancedModifierRules(
            this.redirectRules,
            (rule) => ((x): boolean => x.getAdvancedModifierValue() === rule.getAdvancedModifierValue()),
        );

        // Filters only not allowlist rules.
        result = result.filter((r) => !r.isAllowlist());

        // Splits $redirect and $redirect-rule into separate arrays.
        const conditionalRedirectRules: NetworkRule[] = [];
        const allWeatherRedirectRules: NetworkRule[] = [];
        result.forEach((rule) => {
            const redirectModifier = rule.getAdvancedModifier() as RedirectModifier;
            if (redirectModifier.isRedirectingOnlyBlocked) {
                conditionalRedirectRules.push(rule);
            } else {
                allWeatherRedirectRules.push(rule);
            }
        });

        if (allWeatherRedirectRules.length > 0) {
            return MatchingResult.getHighestPriorityRule(allWeatherRedirectRules);
        }

        if (conditionalRedirectRules.length > 0 && this.basicRule && !this.basicRule.isAllowlist()) {
            return MatchingResult.getHighestPriorityRule(conditionalRedirectRules);
        }

        return null;
    }

    /**
     * Returns an array of cookie rules
     */
    getCookieRules(): NetworkRule[] {
        if (!this.cookieRules) {
            return [];
        }

        const basic = this.getBasicResult();
        if (basic?.isAllowlist() && basic.isOptionEnabled(NetworkRuleOption.Urlblock)) {
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
        return filtered.concat([...this.cookieRules.filter((r) => r.isAllowlist())]);
    }

    /**
     * Returns an array of removeparam rules
     */
    getRemoveParamRules(): NetworkRule[] {
        if (!this.removeParamRules) {
            return [];
        }

        return MatchingResult.filterAdvancedModifierRules(
            this.removeParamRules,
            // eslint-disable-next-line arrow-body-style
            (rule) => ((x): boolean => {
                return x.isHigherPriority(rule) && x.getAdvancedModifierValue() === rule.getAdvancedModifierValue();
            }),
        );
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

        return MatchingResult.filterAdvancedModifierRules(
            this.removeHeaderRules,
            (rule) => ((x): boolean => x.getAdvancedModifierValue() === rule.getAdvancedModifierValue()),
        );
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

    /**
     * Returns the highest priority rule from the given array.
     *
     * @param rules array of network rules
     * @returns hightest priority rule or null if the array is empty
     */
    static getHighestPriorityRule(rules: NetworkRule[]): NetworkRule | null {
        if (rules.length === 0) {
            return null;
        }
        return rules.sort((a, b) => (b.isHigherPriority(a) ? 1 : -1))[0];
    }
}
