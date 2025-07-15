import { type CookieModifier } from '../modifiers/cookie-modifier';
import { type HttpHeadersItem } from '../modifiers/header-modifier';
import { type RedirectModifier } from '../modifiers/redirect-modifier';
import { StealthOptionName, STEALTH_MODE_FILTER_ID } from '../modifiers/stealth-modifier';
import { RequestType } from '../request-type';
import { type NetworkRule, NetworkRuleOption } from '../rules/network-rule';
import { logger } from '../utils/logger';

import { CosmeticOption } from './cosmetic-option';

/**
 * MatchingResult contains all the rules matching a web request, and provides methods
 * that define how a web request should be processed.
 */
export class MatchingResult {
    /**
     * BasicRule - a rule matching the request.
     * It could lead to one of the following:
     * block the request
     * unblock the request (a regular allowlist rule or a document-level allowlist rule)
     * modify the way cosmetic rules work for this request
     * modify the response (see $redirect rules).
     */
    public readonly basicRule: NetworkRule | null;

    /**
     * Rule matching the request's referrer and having on of the following modifiers:
     * - $document — this one basically disables everything;
     * - $urlblock — disables network-level rules (not cosmetic);
     * - $genericblock — disables generic network-level rules.
     *
     * Other document-level modifiers like $jsinject or $content will be ignored here as they don't do anything.
     */
    public documentRule: NetworkRule | null;

    /**
     * Set of rules modifying the response's content-security-policy
     * See $csp modifier.
     */
    public readonly cspRules: NetworkRule[] | null;

    /**
     * Set of rules modifying the request's and response's cookies
     * See $cookie modifier.
     */
    public readonly cookieRules: NetworkRule[] | null;

    /**
     * Set of rules modifying the response's content
     * See $replace modifier.
     */
    public readonly replaceRules: NetworkRule[] | null;

    /**
     * Set of rules redirecting request
     * See $redirect and $redirect-rule modifiers.
     */
    public readonly redirectRules: NetworkRule[] | null;

    /**
     * RemoveParam rules - a set of rules modifying url query parameters
     * See $removeparam modifier.
     */
    public readonly removeParamRules: NetworkRule[] | null;

    /**
     * RemoveHeader rules - a set of rules modifying headers
     * See $removeheader modifier.
     */
    public readonly removeHeaderRules: NetworkRule[] | null;

    /**
     * Permissions rules - a set of rules modifying permissions policy
     * See $permissions modifier.
     */
    public readonly permissionsRules: NetworkRule[] | null;

    /**
     * Headers rules - a set of rules for blocking rules by headers.
     */
    public readonly headerRules: NetworkRule[] | null;

    /**
     * Stealth rules - a set of allowlist rules with $stealth modifier,
     * that negates stealth mode features.
     *
     * Note that the stealth rule can be received from both rules and sourceRules.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#stealth-modifier}
     */
    public readonly stealthRules: NetworkRule[] | null;

    /**
     * CosmeticExceptionRule - a rule that disables cosmetic rules for the document or subdocument.
     * It is moved to it's own filed to not interfere with applying network blocking rules.
     */
    public readonly cosmeticExceptionRule: NetworkRule | null;

    /**
     * PopupRule - this is a rule that specified which way should be used
     * to blocking document request: close the tab or open dummy blocking page.
     * We should store it separately from other blocking rules, because $popup
     * has an intersection by use cases with $all.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#popup-modifier}
     */
    private popupRule: NetworkRule | null;

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
        this.stealthRules = null;
        this.permissionsRules = null;
        this.headerRules = null;
        this.popupRule = null;
        this.cosmeticExceptionRule = null;

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
            if (this.documentRule.isOptionEnabled(NetworkRuleOption.Urlblock)) {
                basicAllowed = false;
            } else if (this.documentRule.isOptionEnabled(NetworkRuleOption.Genericblock)) {
                genericAllowed = false;
            }
        }

        // Iterate through the list of rules and fill the MatchingResult
        for (const rule of rules) {
            if (rule.hasCosmeticOption()) {
                if (!this.cosmeticExceptionRule || rule.isHigherPriority(this.cosmeticExceptionRule)) {
                    this.cosmeticExceptionRule = rule;
                }

                /**
                 * Some rules include both cosmetic options and network modifiers,
                 * and affect both network and cosmetic engines matching.
                 *
                 * Such rules should also compete for `basicRule` slot down below,
                 * e.g `@@||example.org$document` and `@@||nhk.or.jp^$content`.
                 *
                 * Cosmetic options rules that don't contain such modifiers should only affect cosmetic engine.
                 */
                if (!rule.isOptionEnabled(NetworkRuleOption.Urlblock)
                    && !rule.isOptionEnabled(NetworkRuleOption.Genericblock)
                    && !rule.isOptionEnabled(NetworkRuleOption.Content)
                ) {
                    continue;
                }
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Cookie)) {
                (this.cookieRules ??= []).push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Replace)) {
                (this.replaceRules ??= []).push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.RemoveParam)) {
                (this.removeParamRules ??= []).push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.RemoveHeader)) {
                (this.removeHeaderRules ??= []).push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Redirect)) {
                (this.redirectRules ??= []).push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Csp)) {
                (this.cspRules ??= []).push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Stealth)) {
                (this.stealthRules ??= []).push(rule);
                continue;
            }

            if (rule.isOptionEnabled(NetworkRuleOption.Permissions)) {
                (this.permissionsRules ??= []).push(rule);
                continue;
            }

            if (rule.isOptionEnabled(NetworkRuleOption.Header)) {
                (this.headerRules ??= []).push(rule);
                continue;
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Popup)
                // This check needed to split $all rules from $popup rules
                && !MatchingResult.isDocumentRule(rule)) {
                this.popupRule = rule;
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
     * Returns popup rule.
     *
     * @returns The popup rule or null if not found.
     */
    public getPopupRule(): NetworkRule | null {
        return this.popupRule;
    }

    /**
     * GetBasicResult returns a rule that should be applied to the web request.
     *
     * Possible outcomes are:
     * - returns nil -- allow the request;
     * - returns an allowlist rule -- allow the request;
     * - returns a blocking rule -- block the request;
     * - returns a redirect rule -- redirect the request.
     *
     * @returns Basic result rule.
     */
    getBasicResult(): NetworkRule | null {
        let basic = this.basicRule;

        // e.g. @@||example.com^$generichide
        if (this.cosmeticExceptionRule && (!basic || this.cosmeticExceptionRule.isHigherPriority(basic))) {
            return this.cosmeticExceptionRule;
        }

        if (!basic) {
            // Only document-level frame rule would be returned as a basic result,
            // cause only those rules could block or modify page sub-requests.
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

        if (!basic) {
            return this.popupRule;
        }

        return basic;
    }

    /**
     * Returns a rule that should block a document request.
     *
     * @returns Document blocking rule if any, null otherwise.
     */
    getDocumentBlockingResult(): NetworkRule | null {
        if (!this.basicRule || this.basicRule.isDocumentLevelAllowlistRule()) {
            return null;
        }

        // Document-level blocking rules are the only ones that can block 'document' requests
        if (MatchingResult.isDocumentRule(this.basicRule)) {
            return this.basicRule;
        }

        return null;
    }

    /**
     * Returns a single stealth rule, that is corresponding to the given option.
     * If no option is given, returns a rule that disables stealth completely if any.
     *
     * @param stealthOption Stealth option name.
     *
     * @returns Stealth rule or null.
     */
    getStealthRule(stealthOption?: StealthOptionName): NetworkRule | null {
        if (!this.stealthRules) {
            return null;
        }

        return this.stealthRules.find((r: NetworkRule) => {
            const stealthModifier = r.getStealthModifier();
            if (!stealthModifier) {
                logger.debug(`[tsurl.MatchingResult.getStealthRule]: stealth rule without stealth modifier: ${r}`);
                return false;
            }
            if (stealthOption) {
                return stealthModifier.hasStealthOption(stealthOption);
            }

            // $stealth rules without values are globally disabling stealth mode
            return !stealthModifier.hasValues();
        }) ?? null;
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
     * @param responseHeaders Response headers.
     *
     * @returns Header result rule or null.
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
     * Returns a bit-flag with the list of cosmetic options.
     *
     * @returns Cosmetic option mask.
     */
    getCosmeticOption(): CosmeticOption {
        const { basicRule, documentRule, cosmeticExceptionRule } = this;

        let rule = cosmeticExceptionRule || basicRule;

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
     * Return an array of replace rules.
     *
     * @returns An array of replace rules.
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
     * This function result will be called for testing if rule `x` allowlists rule `r`.
     *
     * @param rules Array of rules.
     * @param allowlistPredicate Allowlist criteria.
     *
     * @returns Filtered array of rules.
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
     * Returns an array of csp rules.
     *
     * @returns An array of csp rules.
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
     * Checks if a network rule is sub document rule.
     *
     * @param rule Rule to check.
     *
     * @returns `true` if the rule is sub document rule.
     */
    private static isSubDocumentRule(rule: NetworkRule): boolean {
        return (rule.getPermittedRequestTypes() & RequestType.SubDocument) === RequestType.SubDocument;
    }

    /**
     * Checks if a network rule is document rule.
     *
     * @param rule Rule to check.
     *
     * @returns True if the rule is document rule, false otherwise.
     */
    private static isDocumentRule(rule: NetworkRule): boolean {
        return (rule.getPermittedRequestTypes() & RequestType.Document) === RequestType.Document;
    }

    /**
     * Returns an array of permission policy rules.
     *
     * @returns An array of permission policy rules.
     */
    getPermissionsPolicyRules(): NetworkRule[] {
        if (!this.permissionsRules) {
            return [];
        }

        const allowlistRules: NetworkRule[] = [];
        const blockingRules: NetworkRule[] = [];

        let globalAllowlistRule: NetworkRule | null = null;
        let globalSubDocAllowlistRule: NetworkRule | null = null;

        for (let i = 0; i < this.permissionsRules.length; i += 1) {
            const rule = this.permissionsRules[i];

            if (rule.isAllowlist()) {
                // Global allowlist rule, where $permissions modifier doesn't have a value
                if (!rule.getAdvancedModifierValue()) {
                    if (MatchingResult.isSubDocumentRule(rule)) {
                        if (!globalSubDocAllowlistRule) {
                            // e.g. @@||example.com^$subdocument,permissions
                            globalSubDocAllowlistRule = rule;
                        }
                    } else if (!globalAllowlistRule) {
                        // e.g. @@||example.com^$permissions
                        globalAllowlistRule = rule;
                    }
                } else {
                    allowlistRules.push(rule);
                }
            } else {
                blockingRules.push(rule);
            }
        }

        if (globalAllowlistRule) {
            return [globalAllowlistRule];
        }

        const result: Set<NetworkRule> = new Set();

        blockingRules.forEach((rule) => {
            if (MatchingResult.isSubDocumentRule(rule) && globalSubDocAllowlistRule) {
                result.add(globalSubDocAllowlistRule);
                return;
            }

            const allowlistRule = allowlistRules.find(
                (a) => !rule.isHigherPriority(a) && rule.getAdvancedModifierValue() === a.getAdvancedModifierValue()
                && MatchingResult.isSubDocumentRule(a) === MatchingResult.isSubDocumentRule(rule),
            );

            if (allowlistRule) {
                result.add(allowlistRule);
            } else {
                result.add(rule);
            }
        });

        return Array.from(result);
    }

    /**
     * Returns a redirect rule or null if redirect rules are empty.
     * $redirect-rule is only returned if there's a blocking rule also matching
     * this request.
     *
     * @returns Redirect rule or null if not found.
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
     * Returns an array of cookie rules.
     *
     * @returns An array of cookie rules.
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

        let filtered = MatchingResult.filterAdvancedModifierRules(this.cookieRules, allowlistPredicate);

        // Cookie rule may also be disabled by a stealth rule with corresponding `1p-cookie` or `3p-cookie` value
        // If corresponding $stealth rule is found, such cookie rule does not get into resulting array
        filtered = filtered.filter((cookieRule) => {
            if (cookieRule.getFilterListId() !== STEALTH_MODE_FILTER_ID) {
                return true;
            }

            if (cookieRule.isOptionEnabled(NetworkRuleOption.ThirdParty)) {
                return !this.getStealthRule(StealthOptionName.ThirdPartyCookies);
            }

            return !this.getStealthRule(StealthOptionName.FirstPartyCookies);
        });

        return filtered.concat([...this.cookieRules.filter((r) => r.isAllowlist())]);
    }

    /**
     * Returns an array of removeparam rules.
     *
     * @returns Array of removeparam rules.
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
     * Returns an array of removeheader rules.
     *
     * @returns An array of removeheader rules.
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
     * @param rule CSP rule (not null).
     * @param allowlistRule CSP allowlist rule (may be null).
     * @param map Rules mapped by csp directive.
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
     * matching bad filters from the array (see the $badfilter description for more info).
     *
     * @param rules Rules to filter.
     *
     * @returns Filtered rules.
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
     * @param rules Array of network rules.
     *
     * @returns Hightest priority rule or null if the array is empty.
     */
    static getHighestPriorityRule(rules: NetworkRule[]): NetworkRule | null {
        if (rules.length === 0) {
            return null;
        }
        return rules.sort((a, b) => (b.isHigherPriority(a) ? 1 : -1))[0];
    }
}
