import {
    type CosmeticResult,
    type CosmeticRule,
} from '@adguard/tsurlfilter';

import { appContext } from './app-context';
import { engineApi } from './engine-api';
import { tabsApi } from '../tabs/tabs-api';
// FIXME copy to common
import { createFrameMatchQuery } from '../../mv2/background/utils/create-frame-match-query';
import { getErrorMessage } from '../../common/error';
import { logger } from '../../common/utils/logger';
import { CosmeticApiCommon } from '../../common/cosmetic-api';

import type { ContentType } from '../../common/request-type';
import { ScriptingApi } from './scripting-api';
import { requestContextStorage } from './request/request-context-storage';

export type ApplyCssRulesParams = {
    tabId: number,
    frameId: number,
    cssText: string,
};

export type ApplyScriptRulesParams = {
    tabId: number,
    frameId: number,
    scriptText: string,
};

export type LogJsRulesParams = {
    tabId: number,
    cosmeticResult: CosmeticResult,
    url: string,
    contentType: ContentType,
    timestamp: number,
};

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
 * Cosmetic api class.
 * Used to prepare and inject javascript and css into pages.
 */
export class CosmeticApi extends CosmeticApiCommon {
    private static readonly ELEMHIDE_HIT_START = " { display: none !important; content: 'adguard";

    private static readonly INJECT_HIT_START = " content: 'adguard";

    private static readonly HIT_SEP = encodeURIComponent(';');

    private static readonly HIT_END = "' !important; }";

    /**
     * Applies css from cosmetic result.
     *
     * Patches rule selector adding adguard mark rule info in the content attribute.
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}.
     *
     * @param cssText Css text.
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async injectCss(cssText: string, tabId: number, frameId = 0): Promise<void> {
        return ScriptingApi.insertCss(cssText, tabId, frameId);
    }

    /**
     * Retrieves css styles from the cosmetic result.
     *
     * @param cosmeticResult Cosmetic result.
     * @returns Css styles as string, or `undefined` if no styles found.
     */
    public static getCssText(cosmeticResult: CosmeticResult): string | undefined {
        // FIXME uncomment
        // const { configuration } = appContext;
        //
        // const collectingCosmeticRulesHits = configuration?.settings.collectStats || false;
        const collectingCosmeticRulesHits = false;

        const { elementHiding, CSS } = cosmeticResult;

        const elemhideCss = elementHiding.generic.concat(elementHiding.specific);
        const injectCss = CSS.generic.concat(CSS.specific);

        let styles: string[];

        if (collectingCosmeticRulesHits) {
            styles = CosmeticApi.buildStyleSheetsWithHits(elemhideCss, injectCss);
        } else {
            styles = CosmeticApi.buildStyleSheets(elemhideCss, injectCss, true);
        }

        if (styles.length > 0) {
            return styles.join(CosmeticApi.LINE_BREAK);
        }

        return undefined;
    }

    /**
     * Builds extended css rules from cosmetic result.
     *
     * @param cosmeticResult Cosmetic result.
     * @param collectingCosmeticRulesHits Flag to collect cosmetic rules hits.
     * @returns Array of extended css rules or null.
     */
    public static getExtCssRules(
        cosmeticResult: CosmeticResult,
        collectingCosmeticRulesHits = false,
    ): string[] | null {
        const { elementHiding, CSS } = cosmeticResult;

        const elemhideExtCss = elementHiding.genericExtCss.concat(elementHiding.specificExtCss);
        const injectExtCss = CSS.genericExtCss.concat(CSS.specificExtCss);

        let extCssRules: string[];

        if (collectingCosmeticRulesHits) {
            extCssRules = CosmeticApi.buildStyleSheetsWithHits(elemhideExtCss, injectExtCss);
        } else {
            extCssRules = CosmeticApi.buildStyleSheets(elemhideExtCss, injectExtCss, false);
        }

        return extCssRules.length > 0
            ? extCssRules
            : null;
    }

    /**
     * Builds scripts from cosmetic rules.
     *
     * @returns Script text or empty string if no script rules are passed.
     * @param cosmeticResult Cosmetic result.
     * @param frameUrl Frame url. Used for debug purposes.
     */
    public static getScriptText(cosmeticResult: CosmeticResult, frameUrl: string): string {
        const rules = cosmeticResult.getScriptRules();
        if (rules.length === 0) {
            return '';
        }

        let debug = false;
        const { configuration } = appContext;
        if (configuration) {
            const { settings } = configuration;
            if (settings) {
                // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2584
                debug = settings.debugScriptlets;
            }
        }

        const scriptParams = {
            debug,
            frameUrl,
        };

        const scriptText = rules
            .map((rule) => rule.getScript(scriptParams))
            .join(';\n');

        if (!scriptText) {
            return '';
        }

        return `
        (function () {
            try {
                ${scriptText}
            } catch (ex) {
                console.error('Error executing AG js: ' + ex);
            }
        })();
        `;
    }

    /**
     * Returns content script data for applying cosmetic.
     *
     * @param frameUrl Frame url.
     * @param tabId Tab id.
     * @param frameId Frame id.
     * @returns Content script data for applying cosmetic.
     */
    public static getContentScriptData(
        frameUrl: string,
        tabId: number,
        frameId: number,
    ): ContentScriptCosmeticData {
        const { isStorageInitialized } = appContext;

        const data: ContentScriptCosmeticData = {
            isAppStarted: false,
            areHitsStatsCollected: false,
            extCssRules: null,
        };

        // if storage is not initialized, then app is not ready yet.
        if (!isStorageInitialized) {
            return data;
        }

        // FIXME bring back concept of appContext
        // const { isAppStarted, configuration } = appContext;
        const isAppStarted = true;
        // const areHitsStatsCollected = configuration?.settings.collectStats || false;
        const areHitsStatsCollected = false;

        data.isAppStarted = isAppStarted;
        data.areHitsStatsCollected = areHitsStatsCollected;

        const tabContext = tabsApi.getTabContext(tabId);

        if (!tabContext?.info.url) {
            return data;
        }

        // FIXME remove ts-ignore
        // @ts-ignore
        const matchQuery = createFrameMatchQuery(frameUrl, frameId, tabContext);

        const cosmeticResult = engineApi.matchCosmetic(matchQuery);

        data.extCssRules = CosmeticApi.getExtCssRules(cosmeticResult, areHitsStatsCollected);

        return data;
    }

    /**
     * Applies css rules to specific frame.
     *
     * @param params Data for css rules injecting.
     */
    public static async applyCssRules(params: ApplyCssRulesParams): Promise<void> {
        const {
            tabId,
            frameId,
            cssText,
        } = params;

        await CosmeticApi.injectCss(cssText, tabId, frameId);
    }

    /**
     * Applies js rules to specific frame.
     *
     * @param params Data for js rule injecting.
     */
    public static async applyJsRules(params: ApplyScriptRulesParams): Promise<void> {
        await ScriptingApi.executeScript(params); // FIXME get rid of this function
    }

    /**
     * Injects js to specified frame based on provided data and injection FSM state.
     *
     * @param requestId Request id.
     */
    public static async applyJsByRequest(requestId: string): Promise<void> {
        const requestContext = requestContextStorage.get(requestId);
        if (requestContext?.scriptText) {
            try {
                await CosmeticApi.applyJsRules({
                    tabId: requestContext.tabId,
                    frameId: requestContext.frameId,
                    scriptText: requestContext.scriptText,
                });
            } catch (e) {
                logger.debug('[applyJsByRequest] error occurred during injection', getErrorMessage(e));
            }
        }
    }

    /**
     * Injects js to specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyJsByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const requestContext = requestContextStorage.getByTabAndFrame(tabId, frameId);
        if (requestContext?.scriptText) {
            try {
                await CosmeticApi.applyJsRules({
                    tabId,
                    frameId,
                    scriptText: requestContext.scriptText,
                });
            } catch (e) {
                logger.debug('[applyCssByTabAndFrame] error occurred during injection', getErrorMessage(e));
            }
        }
    }

    /**
     * Injects css to specified tab id and frame id.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyCssByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const requestContext = requestContextStorage.getByTabAndFrame(tabId, frameId);
        if (requestContext?.cssText) {
            try {
                await CosmeticApi.applyCssRules({
                    tabId,
                    frameId,
                    cssText: requestContext.cssText,
                });
            } catch (e) {
                logger.debug('[applyCssByTabAndFrame] error occurred during injection', getErrorMessage(e));
            }
        }
    }

    /**
     * Patches rule selector adding adguard mark rule info in the content attribute.
     * Example:
     * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}.
     *
     * @param rule Elemhide cosmetic rule.
     *
     * @returns Rule with modified stylesheet, containing content marker.
     */
    private static addMarkerToElemhideRule(rule: CosmeticRule): string {
        const result = [];
        result.push(rule.getContent());
        result.push(CosmeticApi.ELEMHIDE_HIT_START);
        result.push(rule.getFilterListId());
        result.push(CosmeticApi.HIT_SEP);
        result.push(rule.getIndex());
        result.push(CosmeticApi.HIT_END);
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
        const result = [];
        const ruleContent = rule.getContent();
        // if rule text has content attribute we don't add rule marker
        const contentAttributeRegex = /[{;"(]\s*content\s*:/gi;
        if (contentAttributeRegex.test(ruleContent)) {
            return ruleContent;
        }

        // remove closing brace
        const ruleTextWithoutCloseBrace = ruleContent.slice(0, -1).trim();
        // check semicolon
        const ruleTextWithSemicolon = ruleTextWithoutCloseBrace.endsWith(';')
            ? ruleTextWithoutCloseBrace
            : `${ruleTextWithoutCloseBrace};`;
        result.push(ruleTextWithSemicolon);
        result.push(CosmeticApi.INJECT_HIT_START);
        result.push(rule.getFilterListId());
        result.push(CosmeticApi.HIT_SEP);
        result.push(rule.getIndex());
        result.push(CosmeticApi.HIT_END);

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
        const elemhideStyles = elemhideRules.map((x) => CosmeticApi.addMarkerToElemhideRule(x));
        const injectStyles = injectRules.map((x) => CosmeticApi.addMarkerToInjectRule(x));

        return [...elemhideStyles, ...injectStyles];
    }
}
