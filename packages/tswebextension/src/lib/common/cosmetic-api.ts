import { CosmeticRuleType } from '@adguard/agtree';
import { type CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { CSS_HITS_MARKER_PREFIX, LF, SEMICOLON } from './constants';
import { defaultFilteringLog, FilteringEventType } from './filtering-log';
import { type ContentType } from './request-type';
import { CssCapabilities } from './utils/css-capabilities';
import { nanoid } from './utils/nanoid';
import { getRuleTexts, type RuleTextProvider } from './utils/rule-text-provider';
import { getDomain } from './utils/url';

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

    /**
     * Individual native CSS element-hiding selectors.
     * Sent to the content script so it can validate and repair grouped CSS
     * injected by the background if any selector in a group is invalid.
     */
    nativeCssSelectors: string[] | null;
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
 * Strategy describing how to encode a hit marker into a CSS rule string.
 * See `CosmeticApiCommon.NATIVE_MARKER` and `EXTENDED_MARKER` for the
 * concrete instances and their rationale.
 */
type HitMarkerStrategy = {
    /**
     * Optional rule prepended once to a stylesheet that contains markers
     * (e.g. `@property --adguard-hit { … }` for the native path). Empty
     * string means no preamble.
     */
    preamble: string;

    /**
     * Opening of the marker declaration, ready to have the encoded
     * `<filterId>%3B<ruleIndex>` and `markerDeclEnd` appended.
     */
    markerDeclStart: string;

    /**
     * Closing of the marker declaration.
     */
    markerDeclEnd: string;

    /**
     * Returns true if the inject rule already has a colliding declaration
     * and must be emitted unchanged (without a marker).
     */
    skipInject: (ruleContent: string) => boolean;
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
     * URL-encoded semicolon (`%3B`) used to separate filterId from ruleIndex
     * inside the marker string. A bare `;` cannot be used because the CSS
     * parser would treat it as the end of the marker declaration.
     * The reader decodes it back via `decodeURIComponent` in
     * `ElementUtils.parseInfo`.
     */
    protected static readonly HIT_SEP = encodeURIComponent(SEMICOLON);

    /**
     * Element hiding declaration block used by `addMarkerToElemhideRule`.
     * Combined with the selector, filterId and ruleIndex it produces the rule below.
     *
     * ```css
     * <selector> { display: none !important; --adguard-hit: 'adguard<id>%3B<idx>' !important; }
     * ```
     */
    protected static readonly ELEMHIDE_BLOCK_START = ' { display: none !important;';

    protected static readonly ELEMHIDE_BLOCK_END = ' }';

    /**
     * `@property` registration for `--adguard-hit`. Emitted once at the top
     * of every stylesheet built with hit markers so the property is
     * non-inheriting and initializes to an empty string on every element.
     */
    // eslint-disable-next-line max-len
    protected static readonly PROPERTY_RULE = "@property --adguard-hit { syntax: '*'; inherits: false; initial-value: ''; }";

    /**
     * Regular expression used by the legacy ExtendedCss marker to detect
     * a user-declared `content:` and skip injection (it would otherwise
     * collide).
     */
    protected static CONTENT_ATTR_RE = /[{;"(]\s*content\s*:/gi;

    /**
     * Hit-marker emission strategy. The cosmetic emitter has two callers
     * with different transports for the marker:
     *
     *   - Native CSS (`<style>` injection) MUST use a custom property so
     *     pseudo-element rules (`::before` / `::after`) cannot paint the
     *     marker as visible text — see AG-265.
     *   - ExtendedCss reads the marker from the *parsed rule object*, never
     *     from the DOM, and the counter blanks `rule.style.content` before
     *     `setStyleToElement`. The marker therefore must travel as a
     *     `content:` declaration in the rule string passed to ExtendedCss.
     */
    protected static readonly NATIVE_MARKER: HitMarkerStrategy = {
        preamble: CosmeticApiCommon.PROPERTY_RULE,
        markerDeclStart: ` --adguard-hit: '${CSS_HITS_MARKER_PREFIX}`,
        markerDeclEnd: "' !important;",
        skipInject: (): boolean => false,
    };

    protected static readonly EXTENDED_MARKER: HitMarkerStrategy = {
        preamble: '',
        markerDeclStart: ` content: '${CSS_HITS_MARKER_PREFIX}`,
        markerDeclEnd: "' !important;",
        skipInject: (ruleContent: string): boolean => {
            // Reset lastIndex because the `g` flag preserves state.
            CosmeticApiCommon.CONTENT_ATTR_RE.lastIndex = 0;
            return CosmeticApiCommon.CONTENT_ATTR_RE.test(ruleContent);
        },
    };

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
     * Wraps an elemhide selector in a hit-marker declaration block.
     *
     * Produces a rule of the form:
     * ```css
     * <selector> { display: none !important; <markerDecl> }
     * ```
     * where `<markerDecl>` is the strategy-specific marker declaration
     * (custom property for native, `content:` for ExtendedCss).
     *
     * @param rule Elemhide cosmetic rule.
     * @param strategy Marker emission strategy.
     *
     * @returns Full CSS rule including marker.
     */
    private static addMarkerToElemhideRule(rule: CosmeticRule, strategy: HitMarkerStrategy): string {
        return [
            rule.getContent(),
            CosmeticApiCommon.ELEMHIDE_BLOCK_START,
            strategy.markerDeclStart,
            String(rule.getFilterListId()),
            CosmeticApiCommon.HIT_SEP,
            String(rule.getIndex()),
            strategy.markerDeclEnd,
            CosmeticApiCommon.ELEMHIDE_BLOCK_END,
        ].join('');
    }

    /**
     * Inserts the strategy's marker declaration into the rule's own
     * declaration block, leaving the selector and any existing
     * declarations untouched.
     *
     * On the native path this is a custom-property declaration that does
     * not collide with anything the rule may already declare. On the
     * ExtendedCss path the marker is `content:`, so a rule that already
     * declares `content:` is emitted unchanged (would otherwise clobber
     * the user declaration).
     *
     * @param rule Inject cosmetic rule.
     * @param strategy Marker emission strategy.
     *
     * @returns Rule string with the marker appended to its block.
     */
    private static addMarkerToInjectRule(rule: CosmeticRule, strategy: HitMarkerStrategy): string {
        const ruleContent = rule.getContent();

        if (strategy.skipInject(ruleContent)) {
            return ruleContent;
        }

        // Strip trailing `}` (and optional trailing whitespace) so we can
        // append the marker declaration; ensure the preceding declaration
        // ends with a `;` to keep the block parseable.
        const ruleTextWithoutCloseBrace = ruleContent.slice(0, -1).trim();
        const ruleTextWithSemicolon = ruleTextWithoutCloseBrace.endsWith(SEMICOLON)
            ? ruleTextWithoutCloseBrace
            : `${ruleTextWithoutCloseBrace}${SEMICOLON}`;

        return [
            ruleTextWithSemicolon,
            strategy.markerDeclStart,
            String(rule.getFilterListId()),
            CosmeticApiCommon.HIT_SEP,
            String(rule.getIndex()),
            strategy.markerDeclEnd,
            CosmeticApiCommon.ELEMHIDE_BLOCK_END,
        ].join('');
    }

    /**
     * Builds stylesheets with hit markers using the given strategy.
     * If the strategy has a non-empty `preamble`, it is prepended once at
     * the top of the returned list.
     *
     * @param elemhideRules Elemhide css rules.
     * @param injectRules Inject css rules.
     * @param strategy Marker emission strategy.
     *
     * @returns List of stylesheet expressions (preamble + one
     * marker-bearing rule per input rule).
     */
    private static buildStyleSheetsWithHits(
        elemhideRules: CosmeticRule[],
        injectRules: CosmeticRule[],
        strategy: HitMarkerStrategy,
    ): string[] {
        const elemhideStyles = elemhideRules.map((x) => CosmeticApiCommon.addMarkerToElemhideRule(x, strategy));
        const injectStyles = injectRules.map((x) => CosmeticApiCommon.addMarkerToInjectRule(x, strategy));

        if (elemhideStyles.length === 0 && injectStyles.length === 0) {
            return [];
        }

        return strategy.preamble
            ? [strategy.preamble, ...elemhideStyles, ...injectStyles]
            : [...elemhideStyles, ...injectStyles];
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
     * Extracts individual native CSS element-hiding selectors from the cosmetic result.
     * These are sent to the content script so it can validate and repair grouped CSS
     * injected by the background if any selector in a group is invalid.
     *
     * @param cosmeticResult Cosmetic result.
     * @param options Options for processing cosmetic rules.
     *
     * @returns Array of individual native CSS selectors, or null if none exist.
     */
    public static getNativeCssSelectors(
        cosmeticResult: CosmeticResult,
        options: CosmeticOptions = {},
    ): string[] | null {
        const { elementHiding } = cosmeticResult;
        const { isNativeHasSupported = false } = options;

        const elemhideReclassified = CosmeticApiCommon.reclassifyNativeAndExtCssRules(
            elementHiding.generic.concat(elementHiding.specific),
            elementHiding.genericExtCss.concat(elementHiding.specificExtCss),
            isNativeHasSupported,
        );

        const selectors = elemhideReclassified.native.map((rule) => rule.getContent());

        return selectors.length > 0 ? selectors : null;
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
                CosmeticApiCommon.EXTENDED_MARKER,
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
                CosmeticApiCommon.NATIVE_MARKER,
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
