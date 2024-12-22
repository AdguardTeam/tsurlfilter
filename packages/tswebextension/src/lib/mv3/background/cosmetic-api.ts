import {
    type CosmeticResult,
    type CosmeticRule,
    type ScriptletData,
} from '@adguard/tsurlfilter';
import { CosmeticRuleType } from '@adguard/agtree';

import { CUSTOM_FILTERS_START_ID, LF, USER_FILTER_ID } from '../../common/constants';
import { appContext } from './app-context';
import { engineApi } from './engine-api';
import { tabsApi } from '../tabs/tabs-api';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { getErrorMessage } from '../../common/error';
import { logger } from '../../common/utils/logger';
import { CosmeticApiCommon } from '../../common/cosmetic-api';
import { ScriptingApi } from './scripting-api';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { getDomain } from '../../common/utils/url';
import { type ContentType } from '../../common/request-type';
import { nanoid } from '../nanoid';
import { localScriptRulesService, type LocalScriptFunction } from './services/local-script-rules-service';

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
 * Data for JS and scriptlets rules.
 */
type ScriptsAndScriptletsData = {
    /**
     * Script text which is combiner from JS rules only from User rules and Custom filters
     * since they are added manually by users. That's why they are considered "local".
     */
    localScriptText: string,

    /**
     * Script functions combined from JS rules from filters which are pre-built into the extension.
     * That's why they are considered "local".
     *
     * Should be executed by chrome scripting api.
     */
    localScriptFunctions: LocalScriptFunction[],

    /**
     * List of scriptlet data objects. No need to separate them by type since they are all safe.
     */
    scriptletDataList: ScriptletData[]
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
     * Blob injection urls.
     */
    private static readonly BLOB_INJECTION_URLS = new Set([
        'facebook.com',
        'open.spotify.com',
    ]);

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

    // FIXME (Slava): check if we need to wrap the same way local script functions
    /**
     * Wraps the given JavaScript code in a self-invoking function for safe execution
     * and appends a source URL comment for debugging purposes.
     *
     * @param scriptText The JavaScript code to wrap.
     * @returns The wrapped script code, or an empty string if the input is falsy.
     */
    private static wrapScriptText(scriptText: string): string {
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
     * Checks whether the cosmetic (JS) rule is added manually by user —
     * is it located in User rules or Custom filters.
     *
     * @param rule Rule to check.
     *
     * @returns True if rule is added manually by user.
     */
    private static isUserAddedRule(rule: CosmeticRule): boolean {
        const filterListId = rule.getFilterListId();
        return filterListId >= CUSTOM_FILTERS_START_ID || filterListId === USER_FILTER_ID;
    }

    /**
     * Generates data for scriptlets and local scripts:
     * - functions for scriptlets,
     * - functions for JS rules from pre-built filters,
     * - script text for JS rules from User rules and Custom filters.
     *
     * @param cosmeticResult Object containing cosmetic rules.
     *
     * @returns An object with data for scriptlets and local scripts — script text and functions.
     */
    public static getScriptsAndScriptletsData(cosmeticResult: CosmeticResult): ScriptsAndScriptletsData {
        const rules = cosmeticResult.getScriptRules();

        if (rules.length === 0) {
            return {
                localScriptText: '',
                localScriptFunctions: [],
                scriptletDataList: [],
            };
        }

        const uniqueScriptFunctions = new Set<LocalScriptFunction>();
        const scriptletDataList = [];
        const uniqueScriptStrings = new Set<string>();

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];
            if (rule.isScriptlet) {
                const scriptletData = rule.getScriptletData();
                if (scriptletData) {
                    scriptletDataList.push(scriptletData);
                }
            } else if (CosmeticApi.isUserAddedRule(rule)) {
                // JS rule is manually added by user locally in the extension — save its script text.
                const scriptText = rule.getScript();
                if (scriptText) {
                    uniqueScriptStrings.add(scriptText.trim());
                }
            } else {
                // FIXME (Slava): check that AG_ scripts are not used in the rules are working.
                // TODO: Optimize script injection by checking if common scripts (e.g., AG_)
                //  are actually used in the rules. If not, avoid injecting them to reduce overhead.

                // JS rule is pre-built into the extension — save its function.
                const scriptFunction = localScriptRulesService.getLocalScriptFunction(rule);
                if (scriptFunction) {
                    uniqueScriptFunctions.add(scriptFunction);
                }
            }
        }

        let scriptText = '';
        uniqueScriptStrings.forEach((script) => {
            scriptText += script.endsWith(';')
                ? `${script}${LF}`
                : `${script};${LF}`;
        });

        const wrappedScriptText = CosmeticApi.wrapScriptText(scriptText);

        return {
            localScriptText: wrappedScriptText,
            localScriptFunctions: [...uniqueScriptFunctions],
            scriptletDataList,
        };
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
     * Injects js to specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyJsFuncsByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext) {
            return;
        }

        const scriptFunctions = frameContext.preparedCosmeticResult?.localScriptFunctions;

        if (!scriptFunctions || scriptFunctions.length === 0) {
            return;
        }

        try {
            await Promise.all(scriptFunctions.map((scriptFunction) => {
                return ScriptingApi.executeScriptFunc({
                    tabId,
                    frameId,
                    scriptFunction,
                });
            }));
        } catch (e) {
            logger.debug('[applyJsFuncsByTabAndFrame] error occurred during injection', getErrorMessage(e));
        }
    }

    /**
     * Injects js locally added rules by user to specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyJsTextByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext) {
            return;
        }

        const localScriptText = frameContext.preparedCosmeticResult?.localScriptText;

        if (!localScriptText) {
            return;
        }

        try {
            await ScriptingApi.executeScriptText({
                tabId,
                frameId,
                scriptText: localScriptText,
            });
        } catch (e) {
            logger.debug('[applyJsTextByTabAndFrame] error occurred during injection', getErrorMessage(e));
        }
    }

    /**
     * Injects js to specified tab and frame.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyScriptletsByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const frameContext = tabsApi.getFrameContext(tabId, frameId);

        if (!frameContext) {
            return;
        }

        const scriptletDataList = frameContext.preparedCosmeticResult?.scriptletDataList;

        if (!scriptletDataList) {
            return;
        }

        try {
            await Promise.all(scriptletDataList.map((scriptletData) => {
                return ScriptingApi.executeScriptlet({
                    tabId,
                    frameId,
                    scriptletData,
                    domainName: getDomain(frameContext.url),
                });
            }));
        } catch (e) {
            logger.debug('[applyScriptletsByTabAndFrame] error occurred during injection', getErrorMessage(e));
        }
    }

    /**
     * Injects css to specified tab id and frame id.
     *
     * @param tabId Tab id.
     * @param frameId Frame id.
     */
    public static async applyCssByTabAndFrame(tabId: number, frameId: number): Promise<void> {
        const requestContext = tabsApi.getFrameContext(tabId, frameId);

        const cssText = requestContext?.preparedCosmeticResult?.cssText;
        if (!cssText) {
            return;
        }

        try {
            await ScriptingApi.insertCSS({
                cssText,
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
            if (scriptRule.isGeneric()) {
                continue;
            }

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
