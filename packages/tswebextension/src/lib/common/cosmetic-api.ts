import { type CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { type ContentType } from './request-type';

/**
 * Information for logging js rules.
 */
export type LogJsRulesParams = {
    /**
     * Tab id.
     */
    tabId: number,

    /**
     * Cosmetic result.
     */
    cosmeticResult: CosmeticResult,

    /**
     * Url.
     */
    url: string,

    /**
     * Content type.
     */
    contentType: ContentType,

    /**
     * Timestamp.
     */
    timestamp: number,
};

/**
 * Data for applying cosmetic rules in content script.
 */
export type ContentScriptCosmeticData = {
    /**
     * Is app started.
     */
    isAppStarted: boolean,

    /**
     * Are hits stats collected.
     */
    areHitsStatsCollected: boolean,

    /**
     * Extended css rules to apply.
     */
    extCssRules: string[] | null,
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
    protected static readonly HIT_SEP = encodeURIComponent(';');

    /**
     * Element hiding CSS style ending.
     */
    protected static readonly HIT_END = "' !important; }";

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
}
