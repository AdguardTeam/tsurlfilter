/**
 * Enumeration with the cosmetic rules markers.
 *
 * All cosmetic rules have similar structure:
 * ```
 * rule = [domains] "marker" content
 * domains = [domain0, domain1[, ...[, domainN]]]
 * ```
 *
 * For instance, element hiding rules look like:
 * `example.org##.banner`
 *
 * In this case:
 * * `[domains]` is `example.org` (comma-separated list of domains)
 * * `marker` is `##` (marker of element hiding rules)
 * * `content` is `.banner` (CSS selector)
 */
export const enum CosmeticRuleMarker {
    /** https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#cosmetic-elemhide-rules */
    ElementHiding = '##',
    /** https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#element-hiding-rules-exceptions */
    ElementHidingException = '#@#',
    /** https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#extended-css-selectors */
    ElementHidingExtCSS = '#?#',
    /** Basically the same as {@link CosmeticRuleMarker.ElementHidingException} */
    ElementHidingExtCSSException = '#@?#',

    /** https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#cosmetic-css-rules */
    Css = '#$#',
    /** https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#cosmetic-css-rules-exceptions */
    CssException = '#@$#',
    /**
     * CSS rules that use extended CSS selectors:
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#extended-css-selectors
     */
    CssExtCSS = '#$?#',
    /** Basically the same as {@link CosmeticRuleMarker.CssException} */
    CssExtCSSException = '#@$?#',

    /** https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#javascript-rules */
    Js = '#%#',
    /** https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#javascript-rules-exceptions-1 */
    JsException = '#@%#',

    /** https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#html-filtering-rules */
    Html = '$$',
    /** https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#html-filtering-rules-exceptions-1 */
    HtmlException = '$@$',
}

/**
 * findCosmeticRuleMarker looks for a cosmetic rule marker in the rule text
 * and returns the start index of the marker and the marker found.
 * If nothing found, it returns -1 and null.
 *
 * @privateRemarks
 *
 * The idea is to search for the rule marker as quickly as possible.
 * If we were simply using `Array.includes` we had to call it a dozen of times (for every marker),
 * and that'd have been much slower.
 *
 * @param ruleText - rule text to scan.
 */
export function findCosmeticRuleMarker(ruleText: string): [number, CosmeticRuleMarker | null] {
    const maxIndex = ruleText.length - 1;
    for (let i = 0; i < maxIndex; i += 1) {
        const char = ruleText.charAt(i);
        switch (char) {
            case '#':
                if (i + 4 <= maxIndex) {
                    if (ruleText.charAt(i + 1) === '@'
                        && ruleText.charAt(i + 2) === '$'
                        && ruleText.charAt(i + 3) === '?'
                        && ruleText.charAt(i + 4) === '#') {
                        return [i, CosmeticRuleMarker.CssExtCSSException];
                    }
                }

                if (i + 3 <= maxIndex) {
                    if (ruleText.charAt(i + 1) === '@'
                        && ruleText.charAt(i + 2) === '?' && ruleText.charAt(i + 3) === '#') {
                        return [i, CosmeticRuleMarker.ElementHidingExtCSSException];
                    }

                    if (ruleText.charAt(i + 1) === '@'
                        && ruleText.charAt(i + 2) === '$' && ruleText.charAt(i + 3) === '#') {
                        return [i, CosmeticRuleMarker.CssException];
                    }

                    if (ruleText.charAt(i + 1) === '@'
                        && ruleText.charAt(i + 2) === '%' && ruleText.charAt(i + 3) === '#') {
                        return [i, CosmeticRuleMarker.JsException];
                    }

                    if (ruleText.charAt(i + 1) === '$'
                        && ruleText.charAt(i + 2) === '?' && ruleText.charAt(i + 3) === '#') {
                        return [i, CosmeticRuleMarker.CssExtCSS];
                    }
                }

                if (i + 2 <= maxIndex) {
                    if (ruleText.charAt(i + 1) === '@' && ruleText.charAt(i + 2) === '#') {
                        return [i, CosmeticRuleMarker.ElementHidingException];
                    }

                    if (ruleText.charAt(i + 1) === '?' && ruleText.charAt(i + 2) === '#') {
                        return [i, CosmeticRuleMarker.ElementHidingExtCSS];
                    }

                    if (ruleText.charAt(i + 1) === '%' && ruleText.charAt(i + 2) === '#') {
                        return [i, CosmeticRuleMarker.Js];
                    }

                    if (ruleText.charAt(i + 1) === '$' && ruleText.charAt(i + 2) === '#') {
                        return [i, CosmeticRuleMarker.Css];
                    }
                }

                if (i + 1 <= maxIndex) {
                    if (ruleText.charAt(i + 1) === '#') {
                        // Handling false positives while looking for cosmetic rules in host files.
                        //
                        // For instance, it could look like this:
                        // 127.0.0.1 localhost ## this is just a comment
                        if (i > 0 && ruleText.charAt(i - 1) === ' ') {
                            return [-1, null];
                        }

                        return [i, CosmeticRuleMarker.ElementHiding];
                    }
                }
                break;
            case '$':
                if (i + 2 <= maxIndex) {
                    if (ruleText.charAt(i + 1) === '@' && ruleText.charAt(i + 2) === '$') {
                        return [i, CosmeticRuleMarker.HtmlException];
                    }
                }

                if (i + 1 <= maxIndex) {
                    if (ruleText.charAt(i + 1) === '$') {
                        return [i, CosmeticRuleMarker.Html];
                    }
                }
                break;
            default:
                break;
        }
    }

    return [-1, null];
}

/**
 * Detects is the rule is extended css rule
 * @param marker - string to check
 */
export function isExtCssMarker(marker: string): boolean {
    const EXTENDED_CSS_MARKERS = [
        CosmeticRuleMarker.CssExtCSS,
        CosmeticRuleMarker.CssExtCSSException,
        CosmeticRuleMarker.ElementHidingExtCSS,
        CosmeticRuleMarker.ElementHidingExtCSSException,
    ];

    return EXTENDED_CSS_MARKERS.indexOf(marker as CosmeticRuleMarker) !== -1;
}

/**
 * AdGuard scriptlet rule mask
 */
export const ADG_SCRIPTLET_MASK = '//scriptlet';
