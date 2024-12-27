import { type CosmeticResult, type CosmeticRule, type ScriptletData } from '@adguard/tsurlfilter';
import { CosmeticRuleType } from '@adguard/agtree';

import { CUSTOM_FILTERS_START_ID, USER_FILTER_ID } from '../../common/constants';
import { CosmeticApiCommon, type ContentScriptCosmeticData, type LogJsRulesParams } from '../../common/cosmetic-api';
import { getErrorMessage } from '../../common/error';
import { defaultFilteringLog, FilteringEventType } from '../../common/filtering-log';
import { createFrameMatchQuery } from '../../common/utils/create-frame-match-query';
import { logger } from '../../common/utils/logger';
import { nanoid } from '../../common/utils/nanoid';
import { getDomain } from '../../common/utils/url';
import { tabsApi } from '../tabs/tabs-api';

import { appContext } from './app-context';
import { engineApi } from './engine-api';
import { ScriptingApi } from './scripting-api';
import { localScriptRulesService, type LocalScriptFunction } from './services/local-script-rules-service';

/**
 * Data for JS and scriptlet rules for MV3.
 */
type ScriptsAndScriptletsDataMv3 = {
    /**
     * Script text which is combined from JS rules only from User rules and Custom filters
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
 * Cosmetic api class.
 * Used to prepare and inject javascript and css into pages.
 */
export class CosmeticApi extends CosmeticApiCommon {
    /**
     * Blob injection urls.
     */
    private static readonly BLOB_INJECTION_URLS = new Set([
        'facebook.com',
        'open.spotify.com',
    ]);

    /**
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
     * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
     *
     * This is STEP 3: All previously matched script rules are processed and filtered:
     * - JS rules from pre-built filters (previously collected, pre-built and passed to the engine)
     *   are going to be executed as functions via chrome.scripting API;
     * - JS rules manually added by users (from User rules and Custom filters)
     *   are going to be executed as script text via script tag injection.
     */
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
    public static getScriptsAndScriptletsData(cosmeticResult: CosmeticResult): ScriptsAndScriptletsDataMv3 {
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
                const scriptStr = rule.getScript();
                if (scriptStr) {
                    uniqueScriptStrings.add(scriptStr);
                }
            } else {
                // TODO: Optimize script injection by checking if common scripts (e.g., AG_)
                //  are actually used in the rules. If not, avoid injecting them to reduce overhead.

                // JS rule is pre-built into the extension — save its function.
                const scriptFunction = localScriptRulesService.getLocalScriptFunction(rule);
                if (scriptFunction) {
                    uniqueScriptFunctions.add(scriptFunction);
                }
            }
        }

        const scriptText = CosmeticApi.combineScripts(uniqueScriptStrings);

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

        const localScriptFunctions = frameContext.preparedCosmeticResult?.localScriptFunctions;

        if (!localScriptFunctions || localScriptFunctions.length === 0) {
            return;
        }

        try {
            await Promise.all(localScriptFunctions.map((scriptFunction) => {
                /**
                 * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
                 *
                 * This is STEP 4.1: Apply JS rules from pre-built filters — via chrome.scripting API.
                 */
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
            /**
             * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
             *
             * This is STEP 4.2: Apply JS rules manually added by users — via script tag injection.
             */
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
