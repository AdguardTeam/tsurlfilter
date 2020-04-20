import * as utils from '../utils/utils';

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
 * Contains all possible cosmetic rule markers.
 * We need this to make {@link findCosmeticRuleMarker} work.
 *
 * Please note, that it's sorted in the {@link init} function.
 */
const markers: CosmeticRuleMarker[] = [
    CosmeticRuleMarker.ElementHiding,
    CosmeticRuleMarker.ElementHidingException,
    CosmeticRuleMarker.ElementHidingExtCSS,
    CosmeticRuleMarker.ElementHidingExtCSSException,
    CosmeticRuleMarker.Css,
    CosmeticRuleMarker.CssException,
    CosmeticRuleMarker.CssExtCSS,
    CosmeticRuleMarker.CssExtCSSException,
    CosmeticRuleMarker.Js,
    CosmeticRuleMarker.JsException,
    CosmeticRuleMarker.Html,
    CosmeticRuleMarker.HtmlException,
];

/**
 * First characters of the cosmetic rules markers.
 * Necessary for {@link findCosmeticRuleMarker} to work properly.
 */
const markersFirstChars: string[] = [];

/** Initializes helper structures */
function init(): void {
    // Sort by markers length in reverse order
    markers.sort((left, right) => right.length - left.length);

    markers.forEach((marker) => {
        const c = marker.charAt(0);
        if (!markersFirstChars.includes(c)) {
            markersFirstChars.push(c);
        }
    });
}

init();

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
    for (const firstMarkerChar of markersFirstChars) {
        const startIndex = ruleText.indexOf(firstMarkerChar);
        if (startIndex === -1) {
            continue;
        }

        // Handling false positives while looking for cosmetic rules in host files.
        //
        // For instance, it could look like this:
        // 127.0.0.1 localhost ## this is just a comment
        if (startIndex > 0 && ruleText.charAt(startIndex - 1) === ' ') {
            continue;
        }

        for (const marker of markers) {
            if (utils.startsAtIndexWith(ruleText, startIndex, marker)) {
                return [startIndex, marker];
            }
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
