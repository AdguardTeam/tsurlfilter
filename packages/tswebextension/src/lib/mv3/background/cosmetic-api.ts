import {
    type CosmeticResult,
    type CosmeticRule,
} from '@adguard/tsurlfilter';
import { CosmeticRuleType } from '@adguard/agtree';

import { appContext } from './app-context';
import { engineApi } from './engine-api';
import { tabsApi } from '../tabs/tabs-api';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { getErrorMessage } from '../../common/error';
import { logger } from '../../common/utils/logger';
import { CosmeticApiCommon } from '../../common/cosmetic-api';
import { type ExecuteScriptParams, type InsertCSSParams, ScriptingApi } from './scripting-api';
import { requestContextStorage } from './request/request-context-storage';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { getDomain } from '../../common/utils/url';
import { type ContentType } from '../../common/request-type';
import { nanoid } from '../nanoid';

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

type ApplyCosmeticResultParams = {
    tabId: number,
    frameId: number,
    cosmeticResult: CosmeticResult,
    frameUrl: string,
};

/**
 * Information for logging js rules.
 */
type LogJsRulesParams = {
    tabId: number,
    cosmeticResult: CosmeticResult,
    url: string,
    contentType: ContentType,
    timestamp: number,
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
     * Flag to enable verbose logging.
     */
    public static verbose: boolean = false;

    /**
     * Retrieves CSS styles from the cosmetic result.
     *
     * @param cosmeticResult Cosmetic result.
     * @returns Css styles as string, or `undefined` if no styles found.
     */
    public static getCssText(cosmeticResult: CosmeticResult): string | undefined {
        const { configuration } = appContext;

        const collectingCosmeticRulesHits = configuration?.settings.collectStats || false;

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
     * @param cosmeticResult Cosmetic result.
     * @param frameUrl Frame url. Used for debug.
     * @returns Script text or empty string if no script rules are passed.
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

        const uniqueScripts = new Set();
        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            uniqueScripts.add(rule.getScript(scriptParams));
        }

        const scriptText = [...uniqueScripts]
            .join(';\n');

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

        const { isAppStarted, configuration } = appContext;
        const areHitsStatsCollected = configuration?.settings.collectStats || false;

        data.isAppStarted = isAppStarted;
        data.areHitsStatsCollected = areHitsStatsCollected;

        const tabContext = tabsApi.getTabContext(tabId);

        if (!tabContext?.info.url) {
            return data;
        }

        const matchQuery = createFrameMatchQuery(frameUrl, frameId, tabContext);

        const cosmeticResult = engineApi.matchCosmetic(matchQuery);

        data.extCssRules = CosmeticApi.getExtCssRules(cosmeticResult, areHitsStatsCollected);

        return data;
    }

    /**
     * Injects js to specified frame based on provided data and injection FSM state.
     *
     * @param requestId Request id.
     */
    public static async applyJsByRequest(requestId: string): Promise<void> {
        const requestContext = requestContextStorage.get(requestId);
        if (!requestContext?.scriptText) {
            return;
        }

        try {
            await ScriptingApi.executeScript({
                tabId: requestContext.tabId,
                frameId: requestContext.frameId,
                scriptText: requestContext.scriptText,
            });
        } catch (e) {
            logger.debug('[applyJsByRequest] error occurred during injection', getErrorMessage(e));
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

        if (!requestContext?.scriptText) {
            return;
        }

        try {
            await ScriptingApi.executeScript({
                tabId,
                frameId,
                scriptText: requestContext.scriptText,
            });
        } catch (e) {
            logger.debug('[applyJsByTabAndFrame] error occurred during injection', getErrorMessage(e));
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
        if (!requestContext?.cssText) {
            return;
        }

        try {
            await ScriptingApi.insertCSS({
                cssText: requestContext.cssText,
                tabId,
                frameId,
            });
        } catch (e) {
            logger.debug(
                '[applyCssByTabAndFrame] error occurred during injection',
                getErrorMessage(e),
                'with request context:',
                requestContext,
            );
        }
    }

    /**
     * Wraps CSS injection with try-catch block.
     * @param params Parameters for applying CSS rules.
     */
    private static async insertCSS(params: InsertCSSParams): Promise<void> {
        try {
            await ScriptingApi.insertCSS(params);
        } catch (e) {
            logger.debug('[insertCSS] error occurred during injection', getErrorMessage(e));
        }
    }

    /**
     * Wraps script execution with try-catch block.
     * @param params Parameters for executing a script.
     */
    private static async executeScript(params: ExecuteScriptParams): Promise<void> {
        try {
            await ScriptingApi.executeScript(params);
        } catch (e) {
            logger.debug('[executeScript] error occurred during injection', getErrorMessage(e));
        }
    }

    /**
     * Injects a cosmetic result to the frame by tab id and frame id.
     *
     * @param params Parameters for applying a cosmetic result.
     * @param params.tabId Tab id.
     * @param params.frameId Frame id.
     * @param params.cosmeticResult Cosmetic result.
     * @param params.frameUrl Frame url.
     * @returns Promise that resolves when the cosmetic result is applied.
     */
    public static async applyCosmeticResult(
        {
            tabId,
            frameId,
            cosmeticResult,
            frameUrl,
        }: ApplyCosmeticResultParams,
    ): Promise<void> {
        const scriptText = CosmeticApi.getScriptText(cosmeticResult, frameUrl);
        const cssText = CosmeticApi.getCssText(cosmeticResult);

        if (cssText) {
            CosmeticApi.insertCSS({
                tabId,
                frameId,
                cssText,
            });
        }

        if (scriptText) {
            CosmeticApi.executeScript({
                tabId,
                frameId,
                scriptText,
            });
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

    /**
     * Logs js rules applied to specific frame.
     *
     * We need a separate function for logging because script rules can be logged before injection
     * to avoid duplicate logs while the js rule is being applied.
     *
     * See {@link WebRequestApi.onBeforeRequest} for details.
     *
     * @param params Data for js rule logging.
     */
    public static logScriptRules(params: LogJsRulesParams): void {
        const {
            tabId,
            cosmeticResult,
            url,
            contentType,
            timestamp,
        } = params;

        const scriptRules = cosmeticResult.getScriptRules();

        for (const scriptRule of scriptRules) {
            if (!scriptRule.isGeneric()) {
                const ruleType = scriptRule.getType();
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
}
