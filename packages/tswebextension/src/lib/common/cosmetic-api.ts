import { CosmeticRuleType } from '@adguard/agtree';
import { type CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { LF, SEMICOLON } from './constants';
import { defaultFilteringLog, FilteringEventType } from './filtering-log';
import { type ContentType } from './request-type';
import { CssCapabilities } from './utils/css-capabilities';
import { getDomain } from './utils/url';
import { nanoid } from './utils/nanoid';
import { getRuleTexts, type RuleTextProvider } from './utils/rule-text-provider';

/**
 * Information for logging js rules.
 */
export type LogJsRulesParams = {
    /**
     * Tab id.
     */
    tabId: number;

    /**
     * Url.
     */
    url: string;

    /**
     * Content type.
     */
    contentType: ContentType;

    /**
     * Timestamp.
     */
    timestamp: number;
};

/**
 * Data for applying cosmetic rules in content script.
 */
export type ContentScriptCosmeticData = {
    /**
     * Is app started.
     */
    isAppStarted: boolean;

    /**
     * Are hits stats collected.
     */
    areHitsStatsCollected: boolean;

    /**
     * Extended css rules to apply.
     */
    extCssRules: string[] | null;
};

/**
 * Options for cosmetic rules processing.
 */
export type CosmeticOptions = {
    /**
     * Flag indicating whether the browser natively supports :has pseudo-class.
     * Pseudo-classes :is() and :not() are supported by older browser versions than :has(),
     * so it is enough to check only :has() support.
     *
     * If true, rules with :has/:is/:not will be treated as native CSS.
     * If false, they will be reclassified as extended CSS.
     *
     * @default false
     */
    isNativeHasSupported?: boolean;

    /**
     * Flag to collect cosmetic rules hits for statistics.
     *
     * @default false
     */
    areHitsStatsCollected?: boolean;
};

/**
 * CosmeticApiCommon contains common logic about building css for hiding elements.
 */
export class CosmeticApiCommon {
    protected static readonly LINE_BREAK = '\r\n';

    /**
     * Number of selectors in grouped selector list.
     */
    protected static readonly CSS_SELECTORS_PER_LINE = 50;

    /**
     * Element hiding CSS style beginning.
     */
    protected static readonly ELEMHIDE_HIT_START = " { display: none !important; content: 'adguard";

    /**
     * CSS style declaration for hit stats.
     */
    protected static readonly INJECT_HIT_START = " content: 'adguard";

    /**
     * Separator for hit stats.
     */
    protected static readonly HIT_SEP = encodeURIComponent(SEMICOLON);

    /**
     * Element hiding CSS style ending.
     */
    protected static readonly HIT_END = "' !important; }";

    /**
     * Regular expression to find content attribute in css rule.
     */
    protected static CONTENT_ATTR_RE = /[{;"(]\s*content\s*:/gi;

    /**
     * Builds stylesheets from rules.
     * If `groupElemhideSelectors` is set,
     * element hiding selector are to be combined into selector lists of {@link CosmeticApi.CSS_SELECTORS_PER_LINE}.
     *
     * @param elemhideRules List of elemhide rules.
     * @param injectRules List of inject css rules.
     * @param groupElemhideSelectors Flag for elemhide selectors grouping.
     *
     * @returns List of stylesheet expressions.
     */
    public static buildStyleSheets(
        elemhideRules: CosmeticRule[],
        injectRules: CosmeticRule[],
        groupElemhideSelectors: boolean,
    ): string[] {
        const styles = [];

        const elemHideStyles = CosmeticApiCommon.buildElemhideStyles(elemhideRules, groupElemhideSelectors);
        if (elemHideStyles.length > 0) {
            if (groupElemhideSelectors) {
                styles.push(elemHideStyles.join(CosmeticApiCommon.LINE_BREAK));
            } else {
                styles.push(...elemHideStyles);
            }
        }

        const cssStyles = injectRules.map((x: CosmeticRule) => x.getContent());
        if (cssStyles.length > 0) {
            if (groupElemhideSelectors) {
                styles.push(cssStyles.join(CosmeticApiCommon.LINE_BREAK));
            } else {
                styles.push(...cssStyles);
            }
        }

        return styles;
    }

    /**
     * Builds element hiding stylesheet from rules.
     * If `groupElemhideSelectors` is set,
     * selector are to be combined into selector lists of {@link CosmeticApi.CSS_SELECTORS_PER_LINE}.
     *
     * @param elemhideRules List of elemhide rules.
     * @param groupElemhideSelectors Flag for elemhide selectors grouping.
     *
     * @returns Array of styles.
     */
    private static buildElemhideStyles(
        elemhideRules: CosmeticRule[],
        groupElemhideSelectors: boolean,
    ): string[] {
        // TODO: refactor constants as ELEMHIDE_CSS_STYLE and ELEMHIDE_HIT_START are duplicates partly
        const ELEMHIDE_CSS_STYLE = ' { display: none !important; }';

        const elemhideSelectors = [];

        for (const selector of elemhideRules) {
            elemhideSelectors.push(selector.getContent());
        }

        // if selector should not be grouped,
        // add element hiding style to each of them
        if (!groupElemhideSelectors) {
            return elemhideSelectors.map((selector) => {
                return `${selector}${ELEMHIDE_CSS_STYLE}`;
            });
        }

        // otherwise selectors should be grouped into selector lists
        const elemhideStyles = [];
        for (let i = 0; i < elemhideSelectors.length; i += CosmeticApiCommon.CSS_SELECTORS_PER_LINE) {
            const selectorList = elemhideSelectors
                .slice(i, i + CosmeticApiCommon.CSS_SELECTORS_PER_LINE)
                .join(', ');
            elemhideStyles.push(`${selectorList}${ELEMHIDE_CSS_STYLE}`);
        }
        return elemhideStyles;
    }

    /**
     * Patches rule selector adding adguard mark rule info in the content attribute.
     *
     * @param rule Elemhide cosmetic rule.
     *
     * @returns Rule with modified stylesheet, containing content marker.
     *
     * @example
     * `.selector` -> `.selector { content: 'adguard{filterId};{ruleText} !important;}`
     */
    private static addMarkerToElemhideRule(rule: CosmeticRule): string {
        const result: string[] = [];
        result.push(rule.getContent());
        result.push(CosmeticApiCommon.ELEMHIDE_HIT_START);
        result.push(String(rule.getFilterListId()));
        result.push(CosmeticApiCommon.HIT_SEP);
        result.push(String(rule.getIndex()));
        result.push(CosmeticApiCommon.HIT_END);
        return result.join('');
    }

    /**
     * Patches rule selector adding adguard mark and rule info in the content style attribute.
     * Example:
     * .selector { color: red } -> .selector { color: red, content: 'adguard{filterId};{ruleText} !important;}.
     *
     * @param rule Inject cosmetic rule.
     *
     * @returns Modified rule with injected content marker into stylesheet.
     */
    private static addMarkerToInjectRule(rule: CosmeticRule): string {
        const result: string[] = [];
        const ruleContent = rule.getContent();
        // if rule text has content attribute we don't add rule marker
        if (CosmeticApiCommon.CONTENT_ATTR_RE.test(ruleContent)) {
            return ruleContent;
        }

        // remove closing brace
        const ruleTextWithoutCloseBrace = ruleContent.slice(0, -1).trim();
        // check semicolon
        const ruleTextWithSemicolon = ruleTextWithoutCloseBrace.endsWith(SEMICOLON)
            ? ruleTextWithoutCloseBrace
            : `${ruleTextWithoutCloseBrace}${SEMICOLON}`;
        result.push(ruleTextWithSemicolon);
        result.push(CosmeticApiCommon.INJECT_HIT_START);
        result.push(String(rule.getFilterListId()));
        result.push(CosmeticApiCommon.HIT_SEP);
        result.push(String(rule.getIndex()));
        result.push(CosmeticApiCommon.HIT_END);

        return result.join('');
    }

    /**
     * Builds stylesheets with css-hits marker.
     *
     * @param elemhideRules Elemhide css rules.
     * @param injectRules Inject css rules.
     *
     * @returns List of stylesheet expressions.
     */
    private static buildStyleSheetsWithHits(
        elemhideRules: CosmeticRule[],
        injectRules: CosmeticRule[],
    ): string[] {
        const elemhideStyles = elemhideRules.map((x) => CosmeticApiCommon.addMarkerToElemhideRule(x));
        const injectStyles = injectRules.map((x) => CosmeticApiCommon.addMarkerToInjectRule(x));

        return [...elemhideStyles, ...injectStyles];
    }

    /**
     * Reclassifies rules containing native-and-ext pseudo-classes,
     * e.g. :has, :is, :not, to extended CSS.
     *
     * @param nativeRules Rules that are marked as native CSS.
     * @param extendedRules Rules that are marked as extended CSS.
     * @param isNativeHasSupported Optional, flag indicating
     * whether the browser natively supports :has/:is/:not pseudo-classes.
     * If not provided, default value is false.
     *
     * @returns Object with reclassified native and extended rules.
     */
    protected static reclassifyNativeAndExtCssRules(
        nativeRules: CosmeticRule[],
        extendedRules: CosmeticRule[],
        isNativeHasSupported = false,
    ): { native: CosmeticRule[]; extended: CosmeticRule[] } {
        // If browser natively supports :has/:is/:not pseudo-classes,
        // no reclassification needed
        if (isNativeHasSupported) {
            return {
                native: nativeRules,
                extended: extendedRules,
            };
        }

        // Move rules with :has/:is/:not to extended CSS
        // if browser doesn't support them
        const reclassifiedNativeRules: CosmeticRule[] = [];
        const reclassifiedExtendedRules: CosmeticRule[] = [...extendedRules];

        for (const rule of nativeRules) {
            const content = rule.getContent();
            if (CssCapabilities.isPotentiallyExtendedCss(content)) {
                // Move to extended CSS
                reclassifiedExtendedRules.push(rule);
            } else {
                // Keep as native CSS
                reclassifiedNativeRules.push(rule);
            }
        }

        return {
            native: reclassifiedNativeRules,
            extended: reclassifiedExtendedRules,
        };
    }

    /**
     * Builds extended css rules from cosmetic result.
     *
     * @param cosmeticResult Cosmetic result.
     * @param options Options for processing cosmetic rules.
     *
     * @returns Array of extended css rules or null.
     */
    public static getExtCssRules(
        cosmeticResult: CosmeticResult,
        options: CosmeticOptions = {},
    ): string[] | null {
        const { elementHiding, CSS } = cosmeticResult;

        const {
            isNativeHasSupported = false,
            areHitsStatsCollected = false,
        } = options;

        // Reclassify element hiding rules if needed
        const elemhideReclassified = CosmeticApiCommon.reclassifyNativeAndExtCssRules(
            elementHiding.generic.concat(elementHiding.specific),
            elementHiding.genericExtCss.concat(elementHiding.specificExtCss),
            isNativeHasSupported,
        );

        // Reclassify CSS injection rules if needed
        const cssReclassified = CosmeticApiCommon.reclassifyNativeAndExtCssRules(
            CSS.generic.concat(CSS.specific),
            CSS.genericExtCss.concat(CSS.specificExtCss),
            isNativeHasSupported,
        );

        let extCssRules: string[];

        if (areHitsStatsCollected) {
            extCssRules = CosmeticApiCommon.buildStyleSheetsWithHits(
                elemhideReclassified.extended,
                cssReclassified.extended,
            );
        } else {
            extCssRules = CosmeticApiCommon.buildStyleSheets(
                elemhideReclassified.extended,
                cssReclassified.extended,
                false,
            );
        }

        return extCssRules.length > 0
            ? extCssRules
            : null;
    }

    /**
     * Retrieves CSS styles from the cosmetic result.
     *
     * @param cosmeticResult Cosmetic result.
     * @param options Options for processing cosmetic rules.
     *
     * @returns Css styles as string, or `undefined` if no styles found.
     */
    public static getCssText(
        cosmeticResult: CosmeticResult,
        options: CosmeticOptions = {},
    ): string | undefined {
        const { elementHiding, CSS } = cosmeticResult;

        const {
            areHitsStatsCollected = false,
            isNativeHasSupported = false,
        } = options;

        // Reclassify rules - only native CSS rules should be included in getCssText
        const elemhideReclassified = CosmeticApiCommon.reclassifyNativeAndExtCssRules(
            elementHiding.generic.concat(elementHiding.specific),
            elementHiding.genericExtCss.concat(elementHiding.specificExtCss),
            isNativeHasSupported,
        );

        const cssReclassified = CosmeticApiCommon.reclassifyNativeAndExtCssRules(
            CSS.generic.concat(CSS.specific),
            CSS.genericExtCss.concat(CSS.specificExtCss),
            isNativeHasSupported,
        );

        let styles: string[];

        if (areHitsStatsCollected) {
            styles = CosmeticApiCommon.buildStyleSheetsWithHits(
                elemhideReclassified.native,
                cssReclassified.native,
            );
        } else {
            styles = CosmeticApiCommon.buildStyleSheets(
                elemhideReclassified.native,
                cssReclassified.native,
                true,
            );
        }

        if (styles.length > 0) {
            return styles.join(CosmeticApiCommon.LINE_BREAK);
        }

        return undefined;
    }

    /**
     * Wraps the given JavaScript code in a self-invoking function for safe execution
     * and appends a source URL comment for debugging purposes.
     *
     * @param scriptText The JavaScript code to wrap.
     *
     * @returns The wrapped script code, or an empty string if the input is falsy.
     */
    protected static wrapScriptText(scriptText: string): string {
        if (!scriptText) {
            return '';
        }

        // The "//# sourceURL=ag-scripts.js" line is necessary to ensure the script always has the same URL,
        // making it possible to debug consistently.
        return `
        (function () {
            try {
                ${scriptText}
            } catch (ex) {
                console.error('Error executing AG js: ' + ex);
            }
        })();
        //# sourceURL=ag-scripts.js
        `;
    }

    /**
     * Combines unique script strings into a single script text.
     *
     * Script string is being trimmed and a semicolon is added if it is missing.
     *
     * @param uniqueScriptStrings Set of unique script strings to combine.
     *
     * @returns Combined script string.
     */
    protected static combineScripts(uniqueScriptStrings: Set<string>): string {
        let scriptText = '';

        uniqueScriptStrings.forEach((rawScriptStr) => {
            const script = rawScriptStr.trim();

            scriptText += script.endsWith(SEMICOLON)
                ? `${script}${LF}`
                : `${script}${SEMICOLON}${LF}`;
        });

        return scriptText;
    }

    /**
     * Logs applied script rules for specified frame.
     *
     * @param params Data for js rule logging.
     * @param appliedScriptRules Script rules applied to the frame.
     * @param engineApi Engine API for retrieving rule texts.
     */
    protected static logScriptRules(
        params: LogJsRulesParams,
        appliedScriptRules: CosmeticRule[],
        engineApi: RuleTextProvider,
    ): void {
        const {
            tabId,
            url,
            contentType,
            timestamp,
        } = params;

        for (const scriptRule of appliedScriptRules) {
            if (scriptRule.isGeneric()) {
                continue;
            }

            const ruleType = scriptRule.getType();
            const { appliedRuleText, originalRuleText } = getRuleTexts(scriptRule, engineApi);

            defaultFilteringLog.publishEvent({
                type: FilteringEventType.JsInject,
                data: {
                    script: true,
                    tabId,
                    // for proper filtering log request info rule displaying
                    // event id should be unique for each event, not copied from request
                    // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2341
                    eventId: nanoid(),
                    requestUrl: url,
                    frameUrl: url,
                    frameDomain: getDomain(url) as string,
                    requestType: contentType,
                    timestamp,
                    filterId: scriptRule.getFilterListId(),
                    ruleIndex: scriptRule.getIndex(),
                    appliedRuleText,
                    originalRuleText,
                    cssRule: ruleType === CosmeticRuleType.ElementHidingRule
                        || ruleType === CosmeticRuleType.CssInjectionRule,
                    scriptRule: ruleType === CosmeticRuleType.ScriptletInjectionRule
                        || ruleType === CosmeticRuleType.JsInjectionRule,
                    contentRule: ruleType === CosmeticRuleType.HtmlFilteringRule,
                },
            });
        }
    }
}
