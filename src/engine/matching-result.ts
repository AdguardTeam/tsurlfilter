import { NetworkRule, NetworkRuleOption } from '../network-rule';

/**
 * CosmeticOption is the enumeration of various content script options.
 * Depending on the set of enabled flags the content script will contain different set of settings.
 */
export enum CosmeticOption {
    /**
     * if generic elemhide and CSS rules are enabled
     * Could be disabled by a $generichide rule.
     */
    CosmeticOptionGenericCSS = 1 << 1,
    /**
     * if elemhide and CSS rules are enabled
     * Could be disabled by an $elemhide rule.
     */
    CosmeticOptionCSS = 1 << 2,
    /**
     * if JS rules and scriptlets are enabled
     * Could be disabled by a $jsinject rule.
     */
    CosmeticOptionJS = 1 << 3,

    /**
     * TODO: Add support for these flags
     * They are useful when content script is injected into an iframe
     * In this case we can check what flags were applied to the top-level frame
     */
    CosmeticOptionSourceGenericCSS = 1 << 4,
    CosmeticOptionSourceCSS = 1 << 5,
    CosmeticOptionSourceJS = 1 << 6,

    /**
     * everything is enabled
     */
    CosmeticOptionAll = CosmeticOptionGenericCSS | CosmeticOptionCSS | CosmeticOptionJS,

    /**
     * everything is disabled
     */
    CosmeticOptionNone = 0
}

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
                this.cookieRules = [];
                this.cookieRules.push(rule);
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Replace)) {
                this.replaceRules = [];
                this.replaceRules.push(rule);
            }
            if (rule.isOptionEnabled(NetworkRuleOption.Csp)) {
                this.cspRules = [];
                this.cspRules.push(rule);
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

        return option;
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
                    if (!badfilter.negatesBadfilter(rule) && !rule.isOptionEnabled(NetworkRuleOption.Badfilter)) {
                        filteredRules.push(rule);
                    }
                }
            }

            return filteredRules;
        }

        return rules;
    }
}
